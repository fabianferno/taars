"""Pipecat TTS service using OpenVoice for voice-cloned speech synthesis.

Streams audio sentence-by-sentence — each sentence is synthesized via MeloTTS,
voice-converted via OpenVoice, and yielded as PCM chunks without temp files.

Usage in a Pipecat pipeline:
    from openvoice_tts_service import OpenVoiceTTSService

    tts = OpenVoiceTTSService(voice_id="fabian", sample_rate=24000)

    pipeline = Pipeline([
        audio_input, vad, stt,
        context_aggregator.user(), llm,
        tts,
        audio_output, context_aggregator.assistant(),
    ])
"""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator, Optional

from loguru import logger

from pipecat.frames.frames import ErrorFrame, Frame, TTSAudioRawFrame
from pipecat.services.tts_service import TTSService

from openvoice_streamer import OpenVoiceStreamer, resample, to_pcm16

DEFAULT_SAMPLE_RATE = 24000
CHUNK_SAMPLES = 480  # 20ms at 24kHz


class OpenVoiceTTSService(TTSService):
    """Pipecat TTS service backed by OpenVoice voice cloning.

    Streams sentence-by-sentence: each sentence is synthesized, voice-converted,
    resampled, and yielded as 20ms PCM chunks — all in memory, no temp files.
    """

    def __init__(
        self,
        voice_id: str,
        *,
        language: str = "EN_NEWEST",
        speed: float = 1.0,
        sample_rate: int = DEFAULT_SAMPLE_RATE,
        streamer: OpenVoiceStreamer | None = None,
        **kwargs,
    ):
        super().__init__(
            sample_rate=sample_rate,
            push_start_frame=True,
            push_stop_frames=True,
            **kwargs,
        )
        self._voice_id = voice_id
        self._language = language
        self._speed = speed
        self._streamer = streamer

    @property
    def streamer(self) -> OpenVoiceStreamer:
        if self._streamer is None:
            self._streamer = OpenVoiceStreamer(language=self._language)
        return self._streamer

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        """Stream cloned speech sentence-by-sentence as PCM chunks."""
        logger.debug(f"OpenVoiceTTS: [{text}] voice='{self._voice_id}'")
        loop = asyncio.get_running_loop()
        chunk_bytes = CHUNK_SAMPLES * 2  # 16-bit mono

        try:
            results = await loop.run_in_executor(
                None,
                lambda: list(
                    self.streamer.generate(self._voice_id, text, self._speed)
                ),
            )

            for _sentence, audio_np in results:
                resampled = resample(audio_np, self.streamer.converter_sr, self.sample_rate)
                pcm = to_pcm16(resampled)

                offset = 0
                while offset < len(pcm):
                    chunk = pcm[offset : offset + chunk_bytes]
                    yield TTSAudioRawFrame(
                        audio=chunk,
                        sample_rate=self.sample_rate,
                        num_channels=1,
                        context_id=context_id,
                    )
                    offset += chunk_bytes

        except Exception as e:
            logger.error(f"OpenVoiceTTS error: {e}")
            yield ErrorFrame(error=str(e))
