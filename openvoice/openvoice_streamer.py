"""Streaming voice cloning: sentence-by-sentence TTS + voice conversion, no temp files.

Usage:
    from openvoice_streamer import OpenVoiceStreamer

    streamer = OpenVoiceStreamer()
    for sentence, audio_np in streamer.generate("fabian", "Hello world. How are you?"):
        # audio_np is float32 numpy at 22050 Hz
        play(audio_np)
"""

from __future__ import annotations

import os
import re

import numpy as np
import torch

from openvoice.api import ToneColorConverter
from openvoice.mel_processing import spectrogram_torch

_ROOT = os.path.dirname(os.path.abspath(__file__))
_CKPT = os.path.join(_ROOT, "checkpoints_v2", "converter")
_SES = os.path.join(_ROOT, "checkpoints_v2", "base_speakers", "ses")
_VOICES_DIR = os.path.join(_ROOT, "voices")


def _pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def resample(audio: np.ndarray, src_sr: int, tgt_sr: int) -> np.ndarray:
    """Fast linear resample."""
    if src_sr == tgt_sr:
        return audio
    n_out = int(len(audio) * tgt_sr / src_sr)
    return np.interp(
        np.linspace(0, len(audio) - 1, n_out),
        np.arange(len(audio)),
        audio,
    )


def to_pcm16(audio: np.ndarray) -> bytes:
    """Convert float32 numpy array to 16-bit PCM bytes."""
    return (audio * 32767).clip(-32768, 32767).astype(np.int16).tobytes()


class OpenVoiceStreamer:
    """Warm model holder that streams voice-cloned audio sentence-by-sentence.

    All models (MeloTTS + ToneColorConverter) are loaded once and kept in memory.
    The generate() method yields (sentence, numpy_audio) tuples — no temp files.
    """

    def __init__(self, device: str | None = None, language: str = "EN_NEWEST"):
        self.device = device or _pick_device()
        self.language = language

        # Load tone color converter
        self._converter = ToneColorConverter(
            os.path.join(_CKPT, "config.json"), device=self.device
        )
        self._converter.load_ckpt(os.path.join(_CKPT, "checkpoint.pth"))
        self.converter_sr = self._converter.hps.data.sampling_rate  # 22050

        # Load MeloTTS
        from melo.api import TTS
        self._tts = TTS(language=language, device=self.device)
        self.tts_sr = self._tts.hps.data.sampling_rate  # 44100

        # Resolve base speaker embedding
        ids = self._tts.hps.data.spk2id
        key = next(iter(ids.keys()))
        self._speaker_id = ids[key]
        key_norm = key.lower().replace("_", "-")
        self._source_se = torch.load(
            os.path.join(_SES, f"{key_norm}.pth"), map_location=self.device
        )

        # Voice embedding cache
        self._se_cache: dict[str, torch.Tensor] = {}

    def _load_voice(self, voice_id: str) -> torch.Tensor:
        if voice_id in self._se_cache:
            return self._se_cache[voice_id]
        se_path = os.path.join(_VOICES_DIR, f"{voice_id}.pth")
        if not os.path.isfile(se_path):
            raise FileNotFoundError(f"No embedding for voice '{voice_id}' at {se_path}")
        se = torch.load(se_path, map_location=self.device)
        self._se_cache[voice_id] = se
        return se

    def _convert_raw(
        self, audio: np.ndarray, src_se: torch.Tensor, tgt_se: torch.Tensor
    ) -> np.ndarray:
        """Voice conversion on a raw numpy array — no file I/O.

        Input: float32 numpy at tts_sr (44100).
        Output: float32 numpy at converter_sr (22050).
        """
        hps = self._converter.hps
        audio = resample(audio, self.tts_sr, self.converter_sr)
        y = torch.FloatTensor(audio).to(self.device).unsqueeze(0)
        with torch.no_grad():
            spec = spectrogram_torch(
                y,
                hps.data.filter_length,
                hps.data.sampling_rate,
                hps.data.hop_length,
                hps.data.win_length,
                center=False,
            ).to(self.device)
            spec_lengths = torch.LongTensor([spec.size(-1)]).to(self.device)
            out = self._converter.model.voice_conversion(
                spec, spec_lengths, sid_src=src_se, sid_tgt=tgt_se, tau=0.3
            )[0][0, 0].data.cpu().float().numpy()
        return out  # float32 at converter_sr (22050)

    def _tts_sentence(self, text: str, speed: float = 1.0) -> np.ndarray:
        """Generate raw audio for a single sentence via MeloTTS.

        Returns float32 numpy at tts_sr (44100).
        """
        from melo import utils
        language = self._tts.language  # processed language (EN, not EN_NEWEST)
        device = self.device

        if language in ["EN", "ZH_MIX_EN"]:
            text = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)

        bert, ja_bert, phones, tones, lang_ids = utils.get_text_for_tts_infer(
            text, language, self._tts.hps, device, self._tts.symbol_to_id
        )
        with torch.no_grad():
            x_tst = phones.to(device).unsqueeze(0)
            tones = tones.to(device).unsqueeze(0)
            lang_ids = lang_ids.to(device).unsqueeze(0)
            bert = bert.to(device).unsqueeze(0)
            ja_bert = ja_bert.to(device).unsqueeze(0)
            x_tst_lengths = torch.LongTensor([phones.size(0)]).to(device)
            speakers = torch.LongTensor([self._speaker_id]).to(device)
            audio = self._tts.model.infer(
                x_tst, x_tst_lengths, speakers, tones, lang_ids,
                bert, ja_bert,
                sdp_ratio=0.2, noise_scale=0.6, noise_scale_w=0.8,
                length_scale=1.0 / speed,
            )[0][0, 0].data.cpu().float().numpy()
        return audio

    def generate(self, voice_id: str, text: str, speed: float = 1.0):
        """Yield (sentence, audio_np) tuples — one per sentence.

        Audio is float32 numpy at converter_sr (22050).
        """
        tgt_se = self._load_voice(voice_id)
        sentences = self._tts.split_sentences_into_pieces(text, self._tts.language, quiet=True)

        for sentence in sentences:
            raw = self._tts_sentence(sentence, speed)
            converted = self._convert_raw(raw, self._source_se, tgt_se)
            yield sentence, converted
