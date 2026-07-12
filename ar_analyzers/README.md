# AdaptFit AR Analyzers

6 real-time pose analysis scripts using MediaPipe + OpenCV.

## ✅ Python Version
- **Works on Python 3.8, 3.9, 3.10, 3.11, 3.12** (your 3.12 is fine)
- No version-specific syntax used

## 📦 Install (one time)

```bash
cd ar_analyzers
pip install -r requirements.txt
```

**requirements:**
- `opencv-python` — camera capture + drawing
- `mediapipe` — pose landmark detection (supports Python 3.12 since v0.10)
- `numpy` — geometry math
- `pyttsx3` — voice coaching (shoulder_analyzer only, others use PowerShell)

> **If pip install mediapipe fails on Python 3.12:**
> ```bash
> pip install mediapipe --pre
> ```
> or
> ```bash
> pip install mediapipe==0.10.14
> ```

---

## 🚀 Quick Launch

```bash
# Interactive menu (pick exercise):
python run_ar.py

# Launch specific exercise:
python run_ar.py pushup
python run_ar.py squat
python run_ar.py plank
python run_ar.py deadlift
python run_ar.py lunge
python run_ar.py shoulder
```

## 🎛️ Options (all exercises)

| Flag | Description |
|------|-------------|
| `--mode pro` | Stricter form thresholds |
| `--flip` | Mirror webcam (selfie cam) |
| `--mute` | Disable voice coaching |
| `--speed 1-10` | Voice speed (default 5) |
| `--video FILE.mp4` | Analyse a saved video |

**Shoulder press extra flags:**
- `--seated` — skip leg drive check
- `--push-press` — allow knee dip

---

## 📐 Camera Setup (CRITICAL)

All exercises need **SIDE VIEW** unless noted otherwise:

| Exercise | Camera Position |
|----------|----------------|
| Push-Ups | Side, chest height |
| Squats | Side, hip/waist height |
| Plank | Side, hip height |
| Deadlift | Side, hip/waist height |
| Lunges | Side, hip height |
| Shoulder Press | Side, shoulder height |

**Tips:**
- Full body (head to toe) must be visible in frame
- Good lighting essential for pose detection
- Step back from camera so full body fits
- Stable surface — don't hold the device

---

## 🎙️ Voice Coaching Notes

- **pushup, squat, plank, deadlift, lunge** → PowerShell TTS (Windows built-in, zero install)
- **shoulder_analyzer** → pyttsx3 (cross-platform: Windows / macOS / Linux)

If voice doesn't work: add `--mute` flag. All form feedback still appears on screen.

---

## 🔑 What Each Analyzer Tracks

### Push-Ups
- ✅ Rep counting (correct / incorrect)
- 🔍 Hips sagging or piking (signed hip deviation)
- 🔍 Elbow flare angle
- 🔍 Head/neck position
- 🗣️ Phase coaching: down → bottom → push up → lockout

### Squats
- ✅ Rep counting
- 🔍 Forward/backward torso lean
- 🔍 Knee caving over toe
- 🔍 Too shallow / too deep
- 🗣️ Phase coaching every stage

### Plank
- ⏱️ Hold timer with milestone announcements (15s, 30s, 60s, 90s, 2min)
- 🔍 Hips sagging / piking
- 🔍 Neck angle (drop / crane)
- 🔍 Shoulder collapse
- ⏸️ Timer pauses when form breaks

### Deadlift
- ✅ Rep counting
- 🔍 Upper + lower back rounding
- 🔍 Bar path drifting from shins
- 🔍 Hips shooting up before shoulders
- 🔍 Too much knee bend (squatting not hinging)
- 🔍 Hyperextension at lockout
- Supports `--style rdl` for Romanian DL

### Lunges
- ✅ Rep counting (per leg)
- 🔍 Front knee caving
- 🔍 Torso lean forward / backward
- 🔍 Insufficient depth (back knee to floor)
- 🔍 Over-bending front knee

### Shoulder Press
- ✅ Rep counting
- 🔍 Lumbar hyperextension (hip thrust)
- 🔍 Excessive trunk lean
- 🔍 Wrist drift off shoulder line
- 🔍 Forward head as bar passes face
- 🔍 Incomplete lockout
- Supports seated OHP + push press modes

---

Press **Q** in the OpenCV window to quit.
