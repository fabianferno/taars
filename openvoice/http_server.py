"""Minimal HTTP wrapper around OpenVoiceStreamer for the taars Node server.

Endpoints:
  POST /clone        multipart upload "sample" (audio/webm or wav) + "voice_id" form field
                     -> registers the voice profile under /voices/<voice_id>.pth
                     -> returns { voice_id, sample_rate }
  POST /synthesize   JSON { voice_id, text, speed? }
                     -> returns audio/wav bytes
  GET  /health       -> { ok: true }

Run:
  cd openvoice
  uv pip install fastapi uvicorn python-multipart soundfile  # (or pip)
  python http_server.py            # listens on :5005
"""

from __future__ import annotations

import io
import os
import tempfile
from typing import Optional

import numpy as np
import soundfile as sf
import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from openvoice.api import ToneColorConverter
from openvoice import se_extractor
from openvoice_streamer import OpenVoiceStreamer, resample, to_pcm16

_ROOT = os.path.dirname(os.path.abspath(__file__))
_CKPT_CONVERTER = os.path.join(_ROOT, "checkpoints_v2", "converter")
_VOICES_DIR = os.path.join(_ROOT, "voices")
os.makedirs(_VOICES_DIR, exist_ok=True)


def _device() -> str:
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


_DEVICE = _device()
_CONVERTER: Optional[ToneColorConverter] = None
_STREAMER: Optional[OpenVoiceStreamer] = None


def converter() -> ToneColorConverter:
    global _CONVERTER
    if _CONVERTER is None:
        cfg = os.path.join(_CKPT_CONVERTER, "config.json")
        ckpt = os.path.join(_CKPT_CONVERTER, "checkpoint.pth")
        c = ToneColorConverter(cfg, device=_DEVICE)
        c.load_ckpt(ckpt)
        _CONVERTER = c
    return _CONVERTER


def streamer() -> OpenVoiceStreamer:
    global _STREAMER
    if _STREAMER is None:
        _STREAMER = OpenVoiceStreamer()
    return _STREAMER


app = FastAPI(title="taars-openvoice", version="0.0.1")


class SynthesizeRequest(BaseModel):
    voice_id: str
    text: str
    speed: float = 1.0


@app.get("/health")
async def health():
    return {"ok": True, "device": _DEVICE}


@app.post("/clone")
async def clone(
    sample: UploadFile = File(...),
    voice_id: str = Form(...),
):
    """Extract a tone-color embedding from an uploaded audio sample and store it
    under /voices/<voice_id>.pth. Idempotent: re-uploading overwrites."""
    if not voice_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(400, "voice_id must be alphanumeric (with optional - or _)")

    # Persist upload to a temp file (se_extractor expects a path).
    suffix = os.path.splitext(sample.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await sample.read())
        tmp_path = tmp.name

    try:
        target_se, _audio_name = se_extractor.get_se(
            tmp_path,
            converter(),
            target_dir=os.path.join(_VOICES_DIR, "_extract"),
            vad=True,
        )
        out = os.path.join(_VOICES_DIR, f"{voice_id}.pth")
        torch.save(target_se, out)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return JSONResponse({"voice_id": voice_id, "sample_rate": 22050})


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    """Generate a single WAV (mono, 24kHz int16) for the given voice + text."""
    pth_path = os.path.join(_VOICES_DIR, f"{req.voice_id}.pth")
    npy_path = os.path.join(_VOICES_DIR, f"{req.voice_id}.npy")
    if not (os.path.exists(pth_path) or os.path.exists(npy_path)):
        raise HTTPException(404, f"voice profile not found: {req.voice_id}")

    audio_chunks: list[np.ndarray] = []
    s = streamer()
    target_sr = 24000
    try:
        for _sentence, audio_np in s.generate(req.voice_id, req.text, req.speed):
            audio_chunks.append(resample(audio_np, s.converter_sr, target_sr))
    except FileNotFoundError as e:
        # Belt-and-suspenders: pre-flight passed but the streamer's loader
        # disagreed about path/format. Surface as 404 so callers can fall back.
        raise HTTPException(404, str(e))

    if not audio_chunks:
        raise HTTPException(500, "no audio generated")
    audio = np.concatenate(audio_chunks)

    buf = io.BytesIO()
    sf.write(buf, audio, target_sr, subtype="PCM_16", format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


if __name__ == "__main__":
    port = int(os.environ.get("OPENVOICE_PORT", "5005"))
    host = os.environ.get("OPENVOICE_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port, log_level="info")
