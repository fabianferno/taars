#!/usr/bin/env python3
"""Minimal OpenVoice V2 demo: clone tone from a reference clip to one English line.

Uses CUDA > MPS (Apple Silicon) > CPU. First run downloads MeloTTS weights via Hugging Face.
"""

import os
import sys

import torch

from openvoice import se_extractor
from openvoice.api import ToneColorConverter


def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda:0"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def main() -> None:
    repo_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(repo_root)

    ckpt_converter = os.path.join(repo_root, "checkpoints_v2", "converter")
    if not os.path.isfile(os.path.join(ckpt_converter, "checkpoint.pth")):
        print(
            "Missing checkpoints_v2. Download checkpoints_v2_0417.zip from USAGE.md and extract here.",
            file=sys.stderr,
        )
        sys.exit(1)

    device = pick_device()
    print("Using device:", device)

    reference_speaker = os.path.join(repo_root, "resources", "fabiansvoice.mp3")
    output_dir = os.path.join(repo_root, "outputs_v2")
    os.makedirs(output_dir, exist_ok=True)

    tone_color_converter = ToneColorConverter(
        os.path.join(ckpt_converter, "config.json"), device=device
    )
    tone_color_converter.load_ckpt(os.path.join(ckpt_converter, "checkpoint.pth"))

    target_se, _audio_name = se_extractor.get_se(
        reference_speaker, tone_color_converter, vad=True
    )

    from melo.api import TTS

    # Longer passages: edit here, or pass text on the CLI, e.g.
    #   python demo_v2_quick.py "First sentence. Second sentence."
    default_text = """
    Good morning everybody. My name is Cartek. I’m one of the co-founders of Eeth Global, and I want to welcome all of you to Pragma New Delhi.
"""
    default_text = " ".join(default_text.split())
    text = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else default_text
    language = "EN_NEWEST"
    src_path = os.path.join(output_dir, "tmp.wav")
    save_path = os.path.join(output_dir, "demo_v2_en_newest.wav")
    speed = 1.0

    model = TTS(language=language, device=device)
    speaker_ids = model.hps.data.spk2id
    speaker_key = next(iter(speaker_ids.keys()))
    speaker_id = speaker_ids[speaker_key]
    speaker_key_norm = speaker_key.lower().replace("_", "-")

    ses_dir = os.path.join(repo_root, "checkpoints_v2", "base_speakers", "ses")
    source_se = torch.load(
        os.path.join(ses_dir, f"{speaker_key_norm}.pth"), map_location=device
    )

    model.tts_to_file(text, speaker_id, src_path, speed=speed)
    tone_color_converter.convert(
        audio_src_path=src_path,
        src_se=source_se,
        tgt_se=target_se,
        output_path=save_path,
        message="@MyShell",
    )
    print("Wrote:", save_path)


if __name__ == "__main__":
    main()
