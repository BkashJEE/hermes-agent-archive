"""
Robot voice + captions generator (free, offline, runs on Windows 11).

Uses Kokoro TTS (Apache-2.0, https://github.com/thewh1teagle/kokoro-onnx)
then adds a robotic effect with numpy. Writes a .wav and a matching .srt
caption file, sentence by sentence, so the captions line up with the voice.

Model files (~120 MB) download to ~/.cache/robot-voice on first run
(override with the ROBOT_VOICE_MODELS environment variable).

Examples:
  python robot_voice.py --channel nous    --text "Hermes agent just shipped a new update."
  python robot_voice.py --channel omarchy --file script.txt --robot 2 --out omarchy_ep1
"""
import argparse
import os
import re
import numpy as np
import urllib.request
from pathlib import Path
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
MODEL_DIR = Path(os.environ.get("ROBOT_VOICE_MODELS", Path.home() / ".cache" / "robot-voice"))

# Channel presets: female voice for Nous, male voice for Omarchy.
# robot_pitch is the flat, monotone pitch (Hz) the robot effect locks to.
PRESETS = {
    "nous":    {"voice": "af_bella",   "speed": 1.05, "robot_pitch": 190.0},
    "omarchy": {"voice": "am_michael", "speed": 1.0,  "robot_pitch": 110.0},
}

# How much of the robotized signal is mixed over the natural voice.
ROBOT_LEVELS = {0: 0.0, 1: 0.25, 2: 0.5, 3: 1.0}


def robotize(audio, sr, pitch_hz, level):
    """Classic phase-vocoder robot: zero every frame's phase and re-add the
    frames at a fixed spacing, so the voice comes out at one flat pitch.
    No echo or tremolo, so it stays smooth and easy to understand."""
    mix = ROBOT_LEVELS[level]
    if mix == 0:
        return audio
    n = 1024
    hop = int(sr / pitch_hz)
    window = np.hanning(n).astype(np.float32)
    padded = np.concatenate([np.zeros(n, np.float32), audio, np.zeros(n, np.float32)])
    out = np.zeros_like(padded)
    norm = np.zeros_like(padded)
    for start in range(0, len(padded) - n, hop):
        frame = padded[start:start + n] * window
        mag = np.abs(np.fft.rfft(frame))
        grain = np.fft.fftshift(np.fft.irfft(mag, n)).astype(np.float32) * window
        out[start:start + n] += grain
        norm[start:start + n] += window ** 2
    robot = (out / np.maximum(norm, 1e-3))[n:n + len(audio)]
    robot *= (np.sqrt(np.mean(audio ** 2)) / (np.sqrt(np.mean(robot ** 2)) or 1.0))
    return ((1 - mix) * audio + mix * robot).astype(np.float32)


def ensure_model(name):
    path = MODEL_DIR / name
    if not path.exists():
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {name} (first run only)...")
        urllib.request.urlretrieve(MODEL_URL + name, path)
    return str(path)


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def srt_time(sec):
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", choices=PRESETS, required=True)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--text")
    src.add_argument("--file", help="UTF-8 text file with the script")
    ap.add_argument("--voice", help="override voice, e.g. af_nicole, am_adam, bm_george")
    ap.add_argument("--speed", type=float)
    ap.add_argument("--robot", type=int, choices=ROBOT_LEVELS, default=1,
                    help="0 = clean, 1 = human with robot tint (default), 2 = half robot, 3 = full robot")
    ap.add_argument("--volume", type=float, default=0.65,
                    help="loudness, 0.1 (quiet) to 1.0 (max); default 0.65")
    ap.add_argument("--gap", type=float, default=0.25, help="pause between sentences (s)")
    ap.add_argument("--out", help="output name without extension")
    args = ap.parse_args()

    preset = PRESETS[args.channel]
    voice = args.voice or preset["voice"]
    speed = args.speed or preset["speed"]
    text = args.text if args.text else open(args.file, encoding="utf-8").read()
    out = args.out or f"{args.channel}_voice"

    kokoro = Kokoro(ensure_model("kokoro-v1.0.int8.onnx"), ensure_model("voices-v1.0.bin"))
    chunks, captions, cursor, sr = [], [], 0.0, 24000
    for sentence in split_sentences(text):
        samples, sr = kokoro.create(sentence, voice=voice, speed=speed, lang="en-us")
        dur = len(samples) / sr
        captions.append((cursor, cursor + dur, sentence))
        chunks += [samples, np.zeros(int(sr * args.gap), dtype=np.float32)]
        cursor += dur + args.gap

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    audio = robotize(np.concatenate(chunks), sr, preset["robot_pitch"], args.robot)
    audio = audio / (np.max(np.abs(audio)) or 1.0) * min(max(args.volume, 0.0), 1.0)
    sf.write(f"{out}.wav", audio, sr)
    with open(f"{out}.srt", "w", encoding="utf-8") as f:
        for i, (a, b, line) in enumerate(captions, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{line}\n\n")
    print(f"Wrote {out}.wav and {out}.srt ({cursor:.1f}s, voice={voice}, robot={args.robot})")


if __name__ == "__main__":
    main()
