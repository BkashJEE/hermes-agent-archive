---
name: robot-voice
description: Generate the channel voiceover (robot-but-human TTS) plus timed .srt captions. Use whenever the user asks for a voiceover, narration, voice, audio, sound, or "reading caption" for a video or post, for the Nous channel (female voice) or the Omarchy channel (male voice).
---

# Robot voice for the Nous and Omarchy channels

Always use this tool and these settings for voiceovers unless the user asks otherwise.
`robot_voice.py` (next to this file) uses Kokoro TTS (free, Apache-2.0, offline, CPU) and writes
`<out>.wav` plus `<out>.srt` captions timed one sentence per line.

## House settings (approved by the user)

| Channel | Flag | Voice | Robot layer |
|---|---|---|---|
| Nous | `--channel nous` | `af_bella` (female), speed 1.05 | 190 Hz |
| Omarchy | `--channel omarchy` | `am_michael` (male), speed 1.0 | 110 Hz |

Defaults: `--robot 1` (human voice with a light robot tint, no echo) and `--volume 0.65`.
The user asked for: less echo, no choppiness, "robot but humanly", and slightly lower volume.
Don't reintroduce echo, comb filters, ring modulation or bit crushing.

## Run it

```bash
pip install kokoro-onnx soundfile          # once per machine/session
python .claude/skills/robot-voice/robot_voice.py --channel nous    --text "..." --out nous_clip
python .claude/skills/robot-voice/robot_voice.py --channel omarchy --file script.txt --out omarchy_clip
```

The first run downloads the model (~120 MB) to `~/.cache/robot-voice`.
In a cloud session, write outputs somewhere the user can open and send them the `.wav` and `.srt`.

Options: `--robot 0..3` (0 clean, 1 default, 2 half robot, 3 full monotone robot),
`--volume 0.1..1.0`, `--speed`, `--gap` (pause between sentences), `--voice` to override.

The user is on Windows 11: give PowerShell commands (`python -m venv venv`, `.\venv\Scripts\Activate.ps1`).
