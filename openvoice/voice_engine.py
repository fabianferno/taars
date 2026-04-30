"""Voice engine: train and infer with voice IDs, models stay warm.

Usage:
    from voice_engine import VoiceEngine

    engine = VoiceEngine()

    # Train once per voice — stores embedding under a voice_id
    engine.train("fabian", "resources/fabiansvoice.mp3")

    # Infer as many times as needed
    engine.infer("fabian", "Hello world!", output_path="out.wav")

    # List registered voices
    engine.list_voices()  # => ["fabian"]
"""

from __future__ import annotations

import json
import os
import uuid

import torch

from openvoice import se_extractor
from openvoice.api import ToneColorConverter

_ROOT = os.path.dirname(os.path.abspath(__file__))
_CKPT = os.path.join(_ROOT, "checkpoints_v2", "converter")
_SES = os.path.join(_ROOT, "checkpoints_v2", "base_speakers", "ses")
_VOICES_DIR = os.path.join(_ROOT, "voices")
_REGISTRY = os.path.join(_VOICES_DIR, "registry.json")


def _pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class VoiceEngine:
    """Warm voice cloning engine with voice ID management."""

    def __init__(self, device: str | None = None):
        self.device = device or _pick_device()

        ckpt_path = os.path.join(_CKPT, "checkpoint.pth")
        if not os.path.isfile(ckpt_path):
            raise FileNotFoundError(
                "Missing checkpoints_v2/converter/checkpoint.pth — "
                "download checkpoints_v2_0417.zip from USAGE.md"
            )

        self._converter = ToneColorConverter(
            os.path.join(_CKPT, "config.json"), device=self.device
        )
        self._converter.load_ckpt(ckpt_path)

        self._tts = None
        self._speaker_id = None
        self._source_se = None

        self._registry = self._load_registry()
        self._se_cache: dict[str, torch.Tensor] = {}

        os.makedirs(_VOICES_DIR, exist_ok=True)

    # ── Registry ──────────────────────────────────────────────────

    def _load_registry(self) -> dict:
        if os.path.isfile(_REGISTRY):
            with open(_REGISTRY) as f:
                return json.load(f)
        return {}

    def _save_registry(self) -> None:
        os.makedirs(_VOICES_DIR, exist_ok=True)
        with open(_REGISTRY, "w") as f:
            json.dump(self._registry, f, indent=2)

    # ── Lazy TTS loader ──────────────────────────────────────────

    def _ensure_tts(self, language: str = "EN_NEWEST") -> None:
        if self._tts is not None:
            return
        from melo.api import TTS

        self._tts = TTS(language=language, device=self.device)
        ids = self._tts.hps.data.spk2id
        key = next(iter(ids.keys()))
        self._speaker_id = ids[key]
        key_norm = key.lower().replace("_", "-")
        self._source_se = torch.load(
            os.path.join(_SES, f"{key_norm}.pth"), map_location=self.device
        )

    # ── Public API ───────────────────────────────────────────────

    def train(self, voice_id: str, reference_audio: str) -> str:
        """Extract speaker embedding from reference audio and register it.

        Args:
            voice_id: A unique name for this voice (e.g. "fabian", "alice").
            reference_audio: Path to the reference audio file.

        Returns:
            The voice_id.
        """
        target_se, _ = se_extractor.get_se(
            reference_audio, self._converter, vad=True
        )

        se_path = os.path.join(_VOICES_DIR, f"{voice_id}.pth")
        torch.save(target_se, se_path)

        self._registry[voice_id] = {
            "embedding": se_path,
            "source_audio": os.path.abspath(reference_audio),
        }
        self._save_registry()
        self._se_cache[voice_id] = target_se

        print(f"Trained voice '{voice_id}' → {se_path}")
        return voice_id

    def infer(
        self,
        voice_id: str,
        text: str,
        output_path: str | None = None,
        language: str = "EN_NEWEST",
        speed: float = 1.0,
    ) -> str:
        """Generate speech in a registered voice.

        Args:
            voice_id: The voice to use (must be trained first).
            text: Text to speak.
            output_path: Where to save the wav. Auto-generated if None.
            language: MeloTTS language code.
            speed: Speech speed multiplier.

        Returns:
            Path to the generated wav file.
        """
        target_se = self._get_embedding(voice_id)
        self._ensure_tts(language)

        out_dir = os.path.join(_ROOT, "outputs_v2")
        os.makedirs(out_dir, exist_ok=True)
        tmp_path = os.path.join(out_dir, "tmp.wav")

        if output_path is None:
            output_path = os.path.join(out_dir, f"{voice_id}_{uuid.uuid4().hex[:8]}.wav")

        self._tts.tts_to_file(text, self._speaker_id, tmp_path, speed=speed)
        self._converter.convert(
            audio_src_path=tmp_path,
            src_se=self._source_se,
            tgt_se=target_se,
            output_path=output_path,
            message="@MyShell",
        )
        return output_path

    def list_voices(self) -> list[str]:
        """Return all registered voice IDs."""
        return list(self._registry.keys())

    def get_voice_info(self, voice_id: str) -> dict:
        """Return metadata for a voice."""
        if voice_id not in self._registry:
            raise KeyError(f"Unknown voice '{voice_id}'. Available: {self.list_voices()}")
        return self._registry[voice_id]

    def rename_voice(self, old_id: str, new_id: str) -> str:
        """Rename a voice ID.

        Returns:
            The new voice_id.
        """
        if new_id in self._registry:
            raise KeyError(f"Voice '{new_id}' already exists")
        info = self.get_voice_info(old_id)

        old_se = info["embedding"]
        new_se = os.path.join(_VOICES_DIR, f"{new_id}.pth")
        if os.path.isfile(old_se):
            os.rename(old_se, new_se)

        info["embedding"] = new_se
        self._registry[new_id] = info
        del self._registry[old_id]

        if old_id in self._se_cache:
            self._se_cache[new_id] = self._se_cache.pop(old_id)

        self._save_registry()
        print(f"Renamed '{old_id}' → '{new_id}'")
        return new_id

    def retrain(self, voice_id: str, reference_audio: str) -> str:
        """Re-train an existing voice with new reference audio.

        Returns:
            The voice_id.
        """
        self.get_voice_info(voice_id)  # ensure it exists
        return self.train(voice_id, reference_audio)

    def delete_voice(self, voice_id: str) -> None:
        """Remove a voice and its embedding."""
        info = self.get_voice_info(voice_id)
        se_path = info["embedding"]
        if os.path.isfile(se_path):
            os.remove(se_path)
        del self._registry[voice_id]
        self._se_cache.pop(voice_id, None)
        self._save_registry()
        print(f"Deleted voice '{voice_id}'")

    # ── Internal ─────────────────────────────────────────────────

    def _get_embedding(self, voice_id: str) -> torch.Tensor:
        if voice_id in self._se_cache:
            return self._se_cache[voice_id]
        info = self.get_voice_info(voice_id)
        se = torch.load(info["embedding"], map_location=self.device)
        self._se_cache[voice_id] = se
        return se


if __name__ == "__main__":
    import sys

    USAGE = """\
Usage:
  python voice_engine.py train   <voice_id> <audio_file>   Create a voice from reference audio
  python voice_engine.py retrain <voice_id> <audio_file>   Update a voice with new audio
  python voice_engine.py infer   <voice_id> <text...>      Generate speech in a voice
  python voice_engine.py list                               List all voices
  python voice_engine.py info    <voice_id>                 Show voice details
  python voice_engine.py rename  <old_id> <new_id>          Rename a voice
  python voice_engine.py delete  <voice_id>                 Delete a voice"""

    if len(sys.argv) < 2:
        print(USAGE)
        sys.exit(1)

    engine = VoiceEngine()
    cmd = sys.argv[1]

    # Shorthand: if first arg is a known voice ID, default to infer
    if cmd in engine.list_voices() and len(sys.argv) >= 3:
        path = engine.infer(cmd, " ".join(sys.argv[2:]))
        print(f"Wrote: {path}")
        sys.exit(0)

    if cmd == "train":
        engine.train(sys.argv[2], sys.argv[3])
    elif cmd == "retrain":
        engine.retrain(sys.argv[2], sys.argv[3])
    elif cmd == "infer":
        path = engine.infer(sys.argv[2], " ".join(sys.argv[3:]))
        print(f"Wrote: {path}")
    elif cmd == "list":
        voices = engine.list_voices()
        if not voices:
            print("No voices registered.")
        else:
            print(f"Voices ({len(voices)}):")
            for v in voices:
                info = engine.get_voice_info(v)
                print(f"  {v}  ← {info['source_audio']}")
    elif cmd == "info":
        info = engine.get_voice_info(sys.argv[2])
        print(json.dumps(info, indent=2))
    elif cmd == "rename":
        engine.rename_voice(sys.argv[2], sys.argv[3])
    elif cmd == "delete":
        engine.delete_voice(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")
        print(USAGE)
