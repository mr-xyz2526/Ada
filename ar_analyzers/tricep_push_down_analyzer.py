"""
AI Fitness Trainer - Tricep Pushdown Analyzer  (v1)
=====================================================
Install:  pip install opencv-python mediapipe numpy pyttsx3

Run:
    python tricep_pushdown_analyzer.py
    python tricep_pushdown_analyzer.py --mode pro
    python tricep_pushdown_analyzer.py --attachment rope     # rope attachment
    python tricep_pushdown_analyzer.py --attachment bar      # straight bar (default)
    python tricep_pushdown_analyzer.py --flip --mute
    python tricep_pushdown_analyzer.py --speed 7             # speech speed 1-10 (default 5)
    python tricep_pushdown_analyzer.py --video clip.mp4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠  CAMERA SETUP: SIDE VIEW (90° to your left or right).
     Camera at roughly waist/hip height, upper body fully in frame.
     This captures elbow extension, upper-arm angle, and torso.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRICEP PUSHDOWN GEOMETRY (SIDE VIEW)
──────────────────────────────────────────────────────────────────
PRIMARY SIGNAL: elbow_angle = joint_angle(shoulder, elbow, wrist)
  This is the key extension indicator.

  s1  START (TOP)  : elbow_angle < ELBOW_START_MAX   (~60–80°, cable pulled down
                     to starting position, forearm roughly parallel to floor)
  s2  MOVING       : between START and FULL EXTENSION
  s3  LOCKOUT (BOT): elbow_angle > ELBOW_LOCKOUT_MIN  (~155–175°, arms fully extended)

  Rep sequence: s1 → s2 → s3 → s2 → s1

SECONDARY SIGNALS:
──────────────────
upper_arm_angle = vert_angle(shoulder, elbow)
  Upper arm must stay VERTICAL (pinned to torso).
  If the elbow drifts forward or backward: upper arm swings.
  Target: < UPPER_ARM_DRIFT_THRESH degrees from vertical.
  This is the #1 cheat pattern in pushdowns — measured per frame.

torso_lean = vert_angle(shoulder, hip)
  Slight forward lean (5–20°) is acceptable.
  Excessive lean (>30°) = using bodyweight / cheating.
  Excessive backward lean (< 0°) = poor stability.

wrist_deviation = lateral displacement of wrist from elbow
  For a straight-bar: wrists should stay neutral (no curl/break).
  For rope: slight outward flare at bottom is OK.
  Threshold scaled by arm length.

shoulder_elevation = shoulder y vs baseline at start
  Shoulders shrugging at any point = traps taking load off triceps.

elbow_flare = 3D z-depth diff between elbows
  Both elbows should track parallel, not flared out wide.

head_tilt = ear-shoulder-vertical angle
  Head neutral throughout. Craning forward = neck strain.

ATTACHMENT MODES:
─────────────────
bar    : wrist neutral required; elbow flare tighter (elbows in)
rope   : slight wrist outward flare OK at bottom; slightly relaxed flare thresh
──────────────────────────────────────────────────────────────────
"""

import argparse
import sys
import time
import queue
import threading
import collections
import cv2
import mediapipe as mp
import numpy as np

try:
    import pyttsx3
    PYTTSX3_OK = True
except ImportError:
    PYTTSX3_OK = False


# ══════════════════════════════════════════════════════════════════════
#  VOICE COACH  — pyttsx3, cross-platform, non-blocking daemon thread
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / session ──────────────────────────────────────────
        'camera_side'     : "Face the camera to your side. The camera should see your profile.",
        'camera_front'    : "You are facing the camera. Rotate 90 degrees so the camera sees your side.",
        'reset'           : "Session reset. Whenever you are ready.",
        'get_ready'       : "Elbows pinned to your sides. Core braced. Slight forward lean. Ready.",
        # ── phase coaching ────────────────────────────────────────────
        'descending'      : "Push down. Keep your elbows locked in. Drive through the tricep.",
        'halfway_down'    : "Halfway. Keep pushing. Elbows still.",
        'at_bottom'       : "Full extension! Squeeze the tricep hard.",
        'pressing_up'     : "Control the return. Fight the cable. Slow on the way up.",
        'at_top'          : "Good. Reset. Elbows in. Go again.",
        # ── rep results ───────────────────────────────────────────────
        'good_rep'        : "Good rep!",
        'no_extension'    : "Not fully extended. Push all the way down until arms are straight.",
        'no_start'        : "Return fully to the start position before the next rep.",
        'bad_form_rep'    : "Form error — rep not counted. Reset and focus.",
        # ── form errors ───────────────────────────────────────────────
        'elbow_drift'     : "Elbows drifting! Pin them to your sides. Upper arm stays vertical.",
        'elbow_flare'     : "Elbows flaring out! Keep them close together, pointing down.",
        'shallow'         : "Push further down! Full extension until arms are nearly straight.",
        'no_lock'         : "Fully extend at the bottom. Squeeze your triceps.",
        'lean_too_much'   : "Too much lean! Straighten up. Do not use bodyweight to push.",
        'lean_too_little' : "Slight forward lean helps. Tilt forward just a few degrees.",
        'wrist_break'     : "Wrists breaking! Keep them straight and aligned with your forearm.",
        'head_fwd'        : "Head neutral! Do not crane your neck forward.",
        'shrug'           : "Shoulders rising! Depress them. Keep them away from your ears.",
        # ── milestone counts ──────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Triceps are burning!",
        '5'  : "5 reps. Keep it tight!",
        '10' : "10 reps. Excellent tricep work!",
        '15' : "15 reps. You are incredibly strong!",
        '20' : "20 reps. Elite level!",
    }

    _COOLDOWN = {
        'camera_side'     : 7.0,
        'camera_front'    : 7.0,
        'reset'           : 5.0,
        'get_ready'       : 6.0,
        'descending'      : 2.5,
        'halfway_down'    : 2.0,
        'at_bottom'       : 2.0,
        'pressing_up'     : 2.5,
        'at_top'          : 2.0,
        'good_rep'        : 1.5,
        'no_extension'    : 3.5,
        'no_start'        : 3.5,
        'bad_form_rep'    : 3.5,
        'elbow_drift'     : 4.0,
        'elbow_flare'     : 4.5,
        'shallow'         : 4.5,
        'no_lock'         : 4.5,
        'lean_too_much'   : 4.0,
        'lean_too_little' : 4.0,
        'wrist_break'     : 4.0,
        'head_fwd'        : 4.0,
        'shrug'           : 4.5,
    }

    _VOICE_PREFS = ['zira', 'hazel', 'susan', 'samantha', 'victoria',
                    'female', 'en_us', 'en-us', 'english']

    def __init__(self, speed: int = 5, mute: bool = False):
        self.mute  = mute
        self._cd   = {}
        self._q    = queue.Queue(maxsize=2)
        self._stop = threading.Event()
        if not mute:
            if PYTTSX3_OK:
                self._rate = int(120 + (speed - 1) * 12)
                threading.Thread(target=self._run, daemon=True).start()
                print(f"🎙  Voice coach active  (pyttsx3 · {self._rate} wpm)")
            else:
                print("⚠  pyttsx3 not installed — voice disabled.")
                print("   Run:  pip install pyttsx3")
                self.mute = True

    def say(self, key: str):
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        self._enqueue(self.PHRASES.get(key, key))

    def say_now(self, key: str):
        if self.mute:
            return
        self._enqueue(self.PHRASES.get(key, key))

    def stop(self):
        self._stop.set()

    def _enqueue(self, text: str):
        while not self._q.empty():
            try:    self._q.get_nowait()
            except queue.Empty: break
        try:    self._q.put_nowait(text)
        except queue.Full: pass

    def _pick_voice(self, engine):
        voices = engine.getProperty('voices')
        if not voices:
            return
        for pref in self._VOICE_PREFS:
            for v in voices:
                name  = (v.name or '').lower()
                langs = ' '.join(str(l) for l in (v.languages or [])).lower()
                if pref in name or pref in langs:
                    engine.setProperty('voice', v.id)
                    return
        engine.setProperty('voice', voices[0].id)

    def _run(self):
        try:
            engine = pyttsx3.init()
        except Exception as e:
            print(f"⚠  pyttsx3 init failed: {e}")
            return
        engine.setProperty('rate',   self._rate)
        engine.setProperty('volume', 1.0)
        self._pick_voice(engine)
        while not self._stop.is_set():
            try:
                text = self._q.get(timeout=0.4)
            except queue.Empty:
                continue
            try:
                engine.say(text)
                engine.runAndWait()
            except Exception:
                pass


# ══════════════════════════════════════════════════════════════════════
#  THRESHOLDS
# ══════════════════════════════════════════════════════════════════════

def get_thresholds(mode: str = 'beginner', attachment: str = 'bar') -> dict:
    """
    Tricep Pushdown Thresholds.

    elbow_angle = joint_angle(shoulder, elbow, wrist)  — PRIMARY signal
      START   : < ELBOW_START_MAX   (elbow bent ~60-80°, forearm ~parallel to floor)
      LOCKOUT : > ELBOW_LOCKOUT_MIN (arms extended ~155-175°, full tricep squeeze)

    upper_arm_angle = vert_angle(shoulder, elbow)      — CRITICAL drift check
      Upper arm must be nearly vertical throughout the movement.
      Drift threshold: > UPPER_ARM_DRIFT_THRESH degrees from vertical
      This is the single most important form check for pushdowns.

    torso_lean  = vert_angle(shoulder, hip)  — bodyweight cheat check
    wrist_dev   = lateral wrist deviation ratio
    sh_elev     = shoulder y rise from baseline (shrug)
    elbow_flare = 3D z-depth elbows difference
    head_angle  = ear-shoulder-vertical joint angle
    """
    if mode == 'pro':
        base = {
            # Depth gating — elbow angle is INCREASING (straightening) on pushdown
            'ELBOW_START_MAX'         : 75,    # above this angle = s1 (START/TOP)
                                               # i.e. elbow must be ≤ 75° to be at start
            'ELBOW_LOCKOUT_MIN'       : 158,   # below this angle = s3 (LOCKOUT/BOTTOM)
            'ELBOW_GOOD_LOCKOUT'      : 155,   # must reach this for rep to count
            'ELBOW_GOOD_START'        : 78,    # must return at least to this for s1
            # Upper arm drift — MOST CRITICAL CHECK
            'UPPER_ARM_DRIFT_THRESH'  : 18,    # degrees from vertical; tighter in pro
            'UPPER_ARM_HIST'          :  5,    # smoothing for upper-arm angle
            # Torso lean
            'LEAN_MIN'                :  2,    # near upright; slight forward lean OK
            'LEAN_MAX'                : 22,    # beyond 22° = using bodyweight
            # Other form checks
            'FLARE_THRESH'            : 22,    # elbow z-diff normalized (degrees equiv)
            'FLARE_FRAMES'            :  4,
            'SH_ELEV_THRESH'          : 0.030, # fraction of frame height shoulder can rise
            'WRIST_DEV_THRESH'        : 0.038, # fraction of arm length wrist can deviate
            'HEAD_FWD_THRESH'         : 52,    # ear-shoulder-vertical; head craning fwd
            # State smoothing
            'ELBOW_HIST'              :  6,
            'HIP_HIST'                :  4,
            'LEAN_HIST'               :  4,
            'SIDE_VIS_THRESH'         : 0.25,
            'FRONT_SPAN_THRESH'       : 0.22,
            'INACTIVE_THRESH'         : 15.0,
            'FB_FRAMES'               :  4,
        }
    else:  # beginner
        base = {
            'ELBOW_START_MAX'         : 82,
            'ELBOW_LOCKOUT_MIN'       : 152,
            'ELBOW_GOOD_LOCKOUT'      : 148,
            'ELBOW_GOOD_START'        : 85,
            'UPPER_ARM_DRIFT_THRESH'  : 26,    # more lenient for beginners
            'UPPER_ARM_HIST'          :  6,
            'LEAN_MIN'                :  0,
            'LEAN_MAX'                : 30,
            'FLARE_THRESH'            : 30,
            'FLARE_FRAMES'            :  5,
            'SH_ELEV_THRESH'          : 0.045,
            'WRIST_DEV_THRESH'        : 0.055,
            'HEAD_FWD_THRESH'         : 58,
            'ELBOW_HIST'              :  6,
            'HIP_HIST'                :  4,
            'LEAN_HIST'               :  4,
            'SIDE_VIS_THRESH'         : 0.30,
            'FRONT_SPAN_THRESH'       : 0.28,
            'INACTIVE_THRESH'         : 15.0,
            'FB_FRAMES'               :  5,
        }

    # Attachment-specific adjustments
    # Rope: slight wrist flare is acceptable at full extension; slightly relaxed flare
    # Bar:  elbows must stay tucked tighter; wrists must stay straight
    if attachment == 'rope':
        base['WRIST_DEV_THRESH']  = min(0.08, base['WRIST_DEV_THRESH'] + 0.018)
        base['FLARE_THRESH']      = min(38,   base['FLARE_THRESH']     + 6)
        base['ATTACHMENT']        = 'rope'
    else:
        base['ATTACHMENT'] = 'bar'

    base['MODE'] = mode
    return base


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3) -> int:
    """Angle at p2 between vectors p2→p1 and p2→p3. Returns 0–180°."""
    v1  = (p1 - p2).astype(float)
    v2  = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot) -> int:
    """Angle of segment p_top→p_bot from vertical. 0° = perfectly upright."""
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def signed_vert_angle(p_top, p_bot) -> float:
    """
    Signed version: positive = leaning forward (x increases downward),
    negative = leaning backward. Used for torso lean direction check.
    """
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return float(np.degrees(np.arctan2(dx, abs(dy) + 1e-9)))


def midpoint_px(a, b):
    return np.array([(a[0] + b[0]) // 2, (a[1] + b[1]) // 2])


def midpoint_n(a, b):
    return np.array([(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2])


def pxc(lm, idx, fw, fh):
    """Landmark → pixel coord (int numpy array)."""
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


def nmc(lm, idx):
    """Landmark → normalised [x, y, z]."""
    p = lm[idx]
    return np.array([p.x, p.y, p.z])


def arm_length_n(sh_n, el_n, wr_n) -> float:
    """Normalised arm length (shoulder→wrist) for scaling thresholds."""
    upper = np.linalg.norm(el_n[:2] - sh_n[:2])
    lower = np.linalg.norm(wr_n[:2] - el_n[:2])
    return max(upper + lower, 0.05)


# ══════════════════════════════════════════════════════════════════════
#  DRAWING HELPERS
# ══════════════════════════════════════════════════════════════════════

FONT = cv2.FONT_HERSHEY_SIMPLEX
AA   = cv2.LINE_AA

C = {
    'green'   : (0,   220,  80),
    'red'     : (30,   50, 230),
    'orange'  : (0,   140, 255),
    'blue'    : (255, 160,   0),
    'yellow'  : (0,   220, 220),
    'cyan'    : (220, 200,   0),
    'white'   : (255, 255, 255),
    'magenta' : (200,   0, 200),
    'dark'    : (20,   20,  20),
    'lt_blue' : (255, 200, 100),
    'gray'    : (110, 110, 110),
    'gold'    : (0,   200, 220),
    'purple'  : (180,   0, 200),
    'teal'    : (180, 200,  50),
    'lime'    : (0,   255, 128),
}


def rr(img, x1, y1, x2, y2, r, color):
    """Filled rounded rectangle."""
    cv2.rectangle(img, (x1,   y1+r), (x2,   y2-r), color, -1)
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r), color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),   color, -1)
    cv2.rectangle(img, (x2-r, y1+r), (x2,   y2-r), color, -1)
    cv2.rectangle(img, (x1+r, y1+r), (x2-r, y2-r), color, -1)
    for cx, cy, sa, ea in [
        (x1+r, y1+r, 180, 270), (x2-r, y1+r, 270, 360),
        (x1+r, y2-r,  90, 180), (x2-r, y2-r,   0,  90),
    ]:
        cv2.ellipse(img, (cx, cy), (r, r), 0, sa, ea, color, -1)


def lbl(img, text, x, y, scale=0.58, fg=None, bg=None, pad=8):
    if fg is None: fg = C['white']
    (tw, th), bl = cv2.getTextSize(text, FONT, scale, 2)
    if bg is not None:
        rr(img, x - pad, y - th - pad, x + tw + pad, y + bl + pad, 5, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def arc_angle(frame, center, vec1, vec2, angle_deg, color, radius=28):
    """Draw an arc representing the joint angle."""
    n1  = vec1 / (np.linalg.norm(vec1) + 1e-9)
    n2  = vec2 / (np.linalg.norm(vec2) + 1e-9)
    sa  = int(np.degrees(np.arctan2(-n1[1], n1[0])))
    ea  = int(np.degrees(np.arctan2(-n2[1], n2[0])))
    cv2.ellipse(frame, tuple(center), (radius, radius), 0, sa, ea, color, 2, AA)
    mid = np.radians((sa + ea) / 2)
    tx  = int(center[0] + (radius + 18) * np.cos(mid))
    ty  = int(center[1] + (radius + 18) * np.sin(mid))
    cv2.putText(frame, f'{angle_deg}°', (tx, ty), FONT, 0.52, color, 2, AA)


def extension_bar(frame, fw, fh, elbow_angle, start_max, lockout_min):
    """
    Vertical progress bar on the right edge showing tricep extension.
    Top = start (bent elbow ~70°), Bottom = full extension (~165°).
    Green zone = lockout target.
    """
    bx, by = fw - 38, 60
    bh     = int(fh * 0.50)
    bw     = 20

    # Normalise: start_max (bent) → top of bar, lockout_min (extended) → bottom
    full_range  = float(lockout_min - start_max)
    current_pct = np.clip((elbow_angle - start_max) / (full_range + 1e-9), 0.0, 1.0)
    lockout_pct = np.clip((lockout_min - start_max) / (full_range + 1e-9), 0.0, 1.0)

    # Background
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (35, 35, 35), -1)

    # Target zone (green band at bottom — full extension)
    t_y1 = int(by + lockout_pct * bh) - int(bh * 0.12)
    t_y2 = by + bh
    cv2.rectangle(frame, (bx, t_y1), (bx+bw, t_y2), (0, 60, 20), -1)

    # Filled progress — fills FROM top downward as elbow extends
    fill_h   = int(current_pct * bh)
    fill_col = (
        (0, 200, 80)   if elbow_angle >= lockout_min  else   # full extension — green
        (0, 200, 200)  if elbow_angle >= start_max    else   # mid range — yellow
        (60, 80, 220)                                          # start zone — blue
    )
    if fill_h > 0:
        cv2.rectangle(frame, (bx, by), (bx+bw, by+fill_h), fill_col, -1)

    # Border
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (80, 80, 80), 1)

    # Labels
    cv2.putText(frame, 'TOP',  (bx - 2, by - 6),       FONT, 0.32, C['gray'], 1, AA)
    cv2.putText(frame, 'BOT',  (bx - 2, by + bh + 14), FONT, 0.32, C['gray'], 1, AA)

    # Tick mark at lockout target
    cv2.line(frame, (bx - 6, t_y1), (bx, t_y1), C['green'], 2, AA)
    cv2.putText(frame, f'{lockout_min}°', (bx - 40, t_y1 + 4), FONT, 0.30, C['green'], 1, AA)

    # Current angle label
    bar_cur_y = int(by + fill_h)
    cv2.putText(frame, f'{elbow_angle}°',
                (bx - 40, bar_cur_y + 5), FONT, 0.38, fill_col, 1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS  idx → (label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('ELBOWS DRIFTING — PIN UPPER ARM VERTICAL',   130, (30,  50, 210), 'elbow_drift'),
    1: ('ELBOWS FLARING — KEEP THEM CLOSE TOGETHER',  178, (30,  50, 210), 'elbow_flare'),
    2: ('PUSH FURTHER DOWN — EXTEND ARMS FULLY',      226, (30,  50, 210), 'shallow'),
    3: ('LOCK OUT — SQUEEZE TRICEPS AT BOTTOM',       274, (30,  50, 210), 'no_lock'),
    4: ('TOO MUCH LEAN — DO NOT USE BODYWEIGHT',      322, (180, 40,  40), 'lean_too_much'),
    5: ('WRISTS BREAKING — KEEP THEM STRAIGHT',       370, (180, 40, 180), 'wrist_break'),
    6: ('SHOULDERS RISING — PACK THEM DOWN',          418, (180, 40,  40), 'shrug'),
    7: ('HEAD FORWARD — KEEP NECK NEUTRAL',           466, (180, 40,  40), 'head_fwd'),
}

# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES
# ══════════════════════════════════════════════════════════════════════

LM = dict(
    nose=0, l_ear=7, r_ear=8,
    l_sh=11, r_sh=12,
    l_el=13, r_el=14,
    l_wr=15, r_wr=16,
    l_hip=23, r_hip=24,
    l_kn=25,  r_kn=26,
    l_ank=27, r_ank=28,
)


# ══════════════════════════════════════════════════════════════════════
#  SIDE-VIEW SELECTOR
# ══════════════════════════════════════════════════════════════════════

def pick_visible_side(lm):
    """
    Returns 'L' or 'R': whichever side has better landmark visibility.
    In side view, the near arm is always more reliable.
    """
    l_vis = (lm[LM['l_sh']].visibility + lm[LM['l_el']].visibility +
             lm[LM['l_wr']].visibility + lm[LM['l_hip']].visibility) / 4
    r_vis = (lm[LM['r_sh']].visibility + lm[LM['r_el']].visibility +
             lm[LM['r_wr']].visibility + lm[LM['r_hip']].visibility) / 4
    return 'L' if l_vis >= r_vis else 'R'


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class TricepPushdownProcessor:

    def __init__(self, T: dict, flip: bool = False, voice: VoiceCoach = None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        # Smoothing buffers
        self._el_hist        = collections.deque(maxlen=T['ELBOW_HIST'])
        self._ua_hist        = collections.deque(maxlen=T['UPPER_ARM_HIST'])  # upper-arm angle
        self._lean_hist      = collections.deque(maxlen=T['LEAN_HIST'])
        self._hip_hist       = collections.deque(maxlen=T['HIP_HIST'])

        # Baselines captured at s1 (start position)
        self._sh_y_baseline: float | None = None

        # Best values in current rep
        self._best_lockout:  int   = 0     # max elbow angle this rep (most extended)
        self._best_start:    int   = 999   # min elbow angle this rep (most bent = start)

        # Camera check counter
        self._cam_front_cnt: int  = 0

        self.S = dict(
            seq             = [],
            prev_state      = None,
            bad_form        = False,

            correct         = 0,
            incorrect       = 0,

            fb_cnt          = np.zeros(8, int),
            fb_show         = np.zeros(8, bool),

            last_phase      = None,
            halfway_said    = False,

            inactive             = 0.0,
            last_t               = time.perf_counter(),

            active_side     = 'L',
        )

    # ─────────────────────────────────────────────────────────────────
    def process(self, frame, pose):
        fh, fw = frame.shape[:2]
        res    = pose.process(frame)

        if not res.pose_landmarks:
            self._no_person(frame, fw)
            return frame

        lm = res.pose_landmarks.landmark
        G  = lambda k: pxc(lm, LM[k], fw, fh)
        N  = lambda k: nmc(lm, LM[k])
        V  = lambda k: lm[LM[k]].visibility

        # ── All landmarks ────────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');  r_sh  = G('r_sh')
        l_el  = G('l_el');  r_el  = G('r_el')
        l_wr  = G('l_wr');  r_wr  = G('r_wr')
        l_hip = G('l_hip'); r_hip = G('r_hip')
        l_kn  = G('l_kn');  r_kn  = G('r_kn')
        l_ank = G('l_ank'); r_ank = G('r_ank')
        l_ear = G('l_ear'); r_ear = G('r_ear')

        n_lsh  = N('l_sh');  n_rsh  = N('r_sh')
        n_lel  = N('l_el');  n_rel  = N('r_el')
        n_lwr  = N('l_wr');  n_rwr  = N('r_wr')
        n_lhip = N('l_hip'); n_rhip = N('r_hip')

        # ── Camera check: warn if FRONT VIEW ────────────────────────
        vis_diff   = abs(V('l_sh') - V('r_sh'))
        sh_span_px = abs(int(l_sh[0]) - int(r_sh[0]))
        is_front   = (vis_diff < self.T['SIDE_VIS_THRESH']
                      and sh_span_px > fw * self.T['FRONT_SPAN_THRESH'])

        self._cam_front_cnt = self._cam_front_cnt + 1 if is_front else 0
        if self._cam_front_cnt >= 22:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_front:
            self._cam_front_cnt = 0

        # ── Select best visible side each frame ──────────────────────
        side = pick_visible_side(lm)
        self.S['active_side'] = side
        if side == 'L':
            sh_px, el_px, wr_px, hip_px, kn_px, ank_px, ear_px = \
                l_sh, l_el, l_wr, l_hip, l_kn, l_ank, l_ear
            n_sh, n_el, n_wr, n_hip = n_lsh, n_lel, n_lwr, n_lhip
        else:
            sh_px, el_px, wr_px, hip_px, kn_px, ank_px, ear_px = \
                r_sh, r_el, r_wr, r_hip, r_kn, r_ank, r_ear
            n_sh, n_el, n_wr, n_hip = n_rsh, n_rel, n_rwr, n_rhip

        # ══════════════════════════════════════════════════════════════
        #  CORE MEASUREMENTS
        # ══════════════════════════════════════════════════════════════

        # ── 1. Elbow angle — PRIMARY EXTENSION SIGNAL ─────────────────
        #    joint_angle(shoulder, elbow, wrist)
        #    START   : ~60–80°  (forearm ~ parallel to floor)
        #    LOCKOUT : ~155–175° (arms nearly straight, full tricep squeeze)
        raw_elbow = joint_angle(sh_px, el_px, wr_px)
        self._el_hist.append(raw_elbow)
        elbow_angle = int(np.mean(self._el_hist))

        # Track best values this rep
        self._best_lockout = max(self._best_lockout, elbow_angle)
        self._best_start   = min(self._best_start,   elbow_angle)

        # ── 2. Upper arm angle — CRITICAL DRIFT CHECK ─────────────────
        #    vert_angle(shoulder, elbow)
        #    For pushdowns, the upper arm (shoulder→elbow) should hang
        #    nearly VERTICAL (0–18° from vertical). Any forward swing of
        #    the elbow is a major form cheat.
        #    NOTE: small angle = good (vertical), large angle = elbow drifted
        raw_ua = vert_angle(sh_px, el_px)
        self._ua_hist.append(raw_ua)
        upper_arm_angle = int(np.mean(self._ua_hist))

        # ── 3. Torso lean — BODYWEIGHT CHEAT CHECK ────────────────────
        #    vert_angle(shoulder, hip) from vertical.
        raw_lean = vert_angle(sh_px, hip_px)
        self._lean_hist.append(raw_lean)
        torso_lean = int(np.mean(self._lean_hist))

        # ── 4. Elbow flare — Z-DEPTH DIFFERENCE ──────────────────────
        sh_width_n   = max(abs(n_lsh[0] - n_rsh[0]), 0.04)
        el_z_diff    = abs(float(n_lel[2]) - float(n_rel[2]))
        flare_angle  = int(np.degrees(np.arctan2(el_z_diff, sh_width_n + 1e-9)))

        # ── 5. Shoulder elevation — SHRUG DETECTION ──────────────────
        sh_y_n = float(n_sh[1])

        # ── 6. Wrist deviation — WRIST STABILITY ─────────────────────
        #    In side view: wrist x should track elbow x in the pushdown path.
        wrist_dev_n    = abs(float(n_wr[0]) - float(n_el[0]))
        arm_len_n      = arm_length_n(n_sh, n_el, n_wr)
        wrist_dev_ratio = wrist_dev_n / (arm_len_n + 1e-9)

        # ── 7. Head angle — FORWARD HEAD CHECK ───────────────────────
        #    Pushdown athletes often crane neck forward.
        #    joint_angle(ear, shoulder, virtual-point-below-shoulder)
        v_below_sh = np.array([sh_px[0], sh_px[1] + 60])
        head_angle = joint_angle(ear_px, sh_px, v_below_sh)

        # ── Determine state ──────────────────────────────────────────
        state = self._state(elbow_angle)

        # Capture baselines at s1 (starting position)
        if state == 's1' and not self.S['seq']:
            self._sh_y_baseline = sh_y_n

        # ══════════════════════════════════════════════════════════════
        #  FORM CHECKS  (8 simultaneous, debounced over FB_FRAMES)
        # ══════════════════════════════════════════════════════════════
        bad   = np.zeros(8, bool)
        T     = self.T
        in_rep = state != 's1' or len(self.S['seq']) > 0

        if in_rep:

            # [0] Upper arm drift — elbow moving forward/away from torso
            #     This is the #1 cheat: upper arm should stay vertical.
            if upper_arm_angle > T['UPPER_ARM_DRIFT_THRESH']:
                bad[0] = True

            # [1] Elbow flare — elbows spreading outward (z-depth diff)
            if flare_angle > T['FLARE_THRESH']:
                bad[1] = True

            # [2] Shallow extension — not reaching lockout during push
            #     Only during descent and at bottom
            if state in ('s2', 's3') and elbow_angle < T['ELBOW_GOOD_LOCKOUT']:
                bad[2] = True

            # [3] Incomplete lockout at bottom
            if state == 's3' and elbow_angle < T['ELBOW_GOOD_LOCKOUT']:
                bad[3] = True

            # [4] Too much torso lean — using bodyweight
            if torso_lean > T['LEAN_MAX']:
                bad[4] = True

            # [5] Wrist deviation — wrists buckling or breaking
            if wrist_dev_ratio > T['WRIST_DEV_THRESH']:
                bad[5] = True

            # [6] Shoulder elevation — shrugging
            if (self._sh_y_baseline is not None
                    and self._sh_y_baseline - sh_y_n > T['SH_ELEV_THRESH']):
                bad[6] = True

            # [7] Head forward — craning neck
            if head_angle > T['HEAD_FWD_THRESH']:
                bad[7] = True

        # Invalidate rep on major movement errors (not just depth quality)
        if any(bad[[0, 1, 4, 5, 6]]):
            self.S['bad_form'] = True

        # Debounce
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= T['FB_FRAMES']

        # Voice: highest-priority confirmed error only
        for i in range(8):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine & rep counting ─────────────────────────────
        self._update_seq(state)
        self._coach_phase(state, elbow_angle)

        if state == 's1' and self.S['prev_state'] != 's1':
            seq           = self.S['seq']
            full_rep      = 's3' in seq
            bad_extension = (self._best_lockout < T['ELBOW_GOOD_LOCKOUT'])
            bad_start     = (self._best_start   > T['ELBOW_GOOD_START'])

            if full_rep and not self.S['bad_form'] and not bad_extension:
                if bad_start:
                    self.S['incorrect'] += 1
                    self.voice.say('no_start')
                    print(f"⚠   Rep — incomplete return to start (best {self._best_start}°)")
                else:
                    self.S['correct'] += 1
                    n = self.S['correct']
                    self.voice.say(str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep')
                    print(f"✅  Rep {n} — elbow peak {self._best_lockout}°, "
                          f"start {self._best_start}°, "
                          f"UA drift {upper_arm_angle}°, lean {torso_lean}°")
            elif full_rep and bad_extension:
                self.S['incorrect'] += 1
                self.voice.say('no_extension')
                print(f"⚠   Rep — insufficient extension (best {self._best_lockout}°)")
            elif full_rep and self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"⚠   Rep — form error flagged")
            elif not full_rep and seq:
                self.S['incorrect'] += 1
                self.voice.say('no_extension')
                print(f"⚠   Partial rep — lockout not reached")

            # Reset for next rep
            self.S['seq']         = []
            self.S['bad_form']    = False
            self.S['halfway_said']= False
            self._best_lockout    = 0
            self._best_start      = 999
            if self._sh_y_baseline is not None:
                self._sh_y_baseline = sh_y_n

        self.S['prev_state'] = state

        # ══════════════════════════════════════════════════════════════
        #  DRAWING
        # ══════════════════════════════════════════════════════════════
        self._draw_skeleton(frame,
                            l_sh, r_sh, l_el, r_el, l_wr, r_wr,
                            l_hip, r_hip, l_kn, r_kn, l_ank, r_ank,
                            l_ear, r_ear, nose)

        # Primary angles on active arm
        self._draw_elbow_arc(frame, sh_px, el_px, wr_px, elbow_angle, side)
        self._draw_upper_arm_angle(frame, sh_px, el_px, upper_arm_angle)
        self._draw_torso_angle(frame, sh_px, hip_px, torso_lean)
        self._draw_wrist_line(frame, el_px, wr_px, wrist_dev_ratio, T)
        self._draw_head_line(frame, ear_px, sh_px, head_angle)

        # Extension bar (right edge)
        extension_bar(frame, fw, fh, elbow_angle,
                      T['ELBOW_START_MAX'], T['ELBOW_LOCKOUT_MIN'])

        # HUD
        self._draw_hud(frame, fw, state, elbow_angle, upper_arm_angle, torso_lean)
        self._draw_feedback(frame)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, elbow_angle: int) -> str:
        """
        Three states driven by elbow angle:
          s1  START (TOP)   elbow_angle < ELBOW_START_MAX   (~75–82°, arm bent)
          s3  LOCKOUT (BOT) elbow_angle > ELBOW_LOCKOUT_MIN (~152–158°, arm extended)
          s2  MOVING        everything in between

        NOTE: direction is OPPOSITE to chest dip — elbow angle INCREASES
        as you push DOWN (extend the arm).
        """
        if elbow_angle <= self.T['ELBOW_START_MAX']:    return 's1'
        if elbow_angle >= self.T['ELBOW_LOCKOUT_MIN']:  return 's3'
        return 's2'

    def _update_seq(self, state: str):
        """Track s2 → s3 → s2 within a rep. s1 triggers evaluation."""
        seq = self.S['seq']
        if state == 's2':
            if ('s3' not in seq and seq.count('s2') == 0) or \
               ('s3' in seq     and seq.count('s2') == 1):
                seq.append(state)
        elif state == 's3':
            if 's3' not in seq and 's2' in seq:
                seq.append(state)

    # ─────────────────────────────────────────────────────────────────
    #  VOICE PHASE COACHING
    # ─────────────────────────────────────────────────────────────────

    def _coach_phase(self, state: str, elbow_angle: int):
        if state != self.S['last_phase']:
            self.S['last_phase'] = state

            if state == 's1':
                if not self.S['seq']:
                    self.voice.say('get_ready')
                else:
                    self.voice.say('at_top')

            elif state == 's2':
                if 's3' not in self.S['seq']:
                    self.voice.say('descending')
                else:
                    self.voice.say('pressing_up')

            elif state == 's3':
                self.voice.say('at_bottom')

        # Mid-push cue
        halfway_angle = (self.T['ELBOW_START_MAX'] + self.T['ELBOW_LOCKOUT_MIN']) // 2
        if (state == 's2'
                and 's3' not in self.S['seq']
                and elbow_angle >= halfway_angle
                and not self.S['halfway_said']):
            self.S['halfway_said'] = True
            self.voice.say('halfway_down')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame,
                       l_sh, r_sh, l_el, r_el, l_wr, r_wr,
                       l_hip, r_hip, l_kn, r_kn, l_ank, r_ank,
                       l_ear, r_ear, nose):
        lw = 3
        sh_mid  = midpoint_px(l_sh,  r_sh)
        hip_mid = midpoint_px(l_hip, r_hip)

        # Torso
        cv2.line(frame, tuple(sh_mid),  tuple(hip_mid), C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_sh),    tuple(r_sh),    C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_hip),   tuple(r_hip),   C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_sh),    tuple(l_hip),   C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(r_sh),    tuple(r_hip),   C['lt_blue'], lw, AA)

        # Legs (lighter — not the focus)
        for a, b in [(l_hip, l_kn), (l_kn, l_ank),
                     (r_hip, r_kn), (r_kn, r_ank)]:
            cv2.line(frame, tuple(a), tuple(b), C['cyan'], lw, AA)

        # Arms (GOLD — primary movers)
        for a, b in [(l_sh, l_el), (l_el, l_wr),
                     (r_sh, r_el), (r_el, r_wr)]:
            cv2.line(frame, tuple(a), tuple(b), C['gold'], lw + 2, AA)

        # Head/neck
        ear_mid = midpoint_px(l_ear, r_ear)
        cv2.line(frame, tuple(sh_mid), tuple(ear_mid), C['white'], lw, AA)
        cv2.line(frame, tuple(ear_mid), tuple(nose),   C['white'], lw, AA)

        # Joints
        for pt in (l_sh, r_sh, l_hip, r_hip):
            cv2.circle(frame, tuple(pt), 7,  C['lt_blue'], -1, AA)
            cv2.circle(frame, tuple(pt), 7,  C['white'],    1, AA)
        for pt in (l_el, r_el, l_wr, r_wr):
            cv2.circle(frame, tuple(pt), 9,  C['gold'],    -1, AA)
            cv2.circle(frame, tuple(pt), 9,  C['white'],    2, AA)
        for pt in (l_kn, r_kn, l_ank, r_ank):
            cv2.circle(frame, tuple(pt), 5,  C['cyan'],    -1, AA)
        cv2.circle(frame, tuple(nose),  7, C['white'], -1, AA)
        cv2.circle(frame, tuple(l_ear), 5, C['gray'],  -1, AA)
        cv2.circle(frame, tuple(r_ear), 5, C['gray'],  -1, AA)

    def _draw_elbow_arc(self, frame, sh, el, wr, angle, side):
        """
        Elbow angle arc. For pushdowns:
          Green  = full extension (≥ ELBOW_LOCKOUT_MIN)
          Orange = mid-range
          Blue   = at start / bent
        """
        T   = self.T
        col = (C['green']  if angle >= T['ELBOW_LOCKOUT_MIN']
               else C['orange'] if angle >= T['ELBOW_START_MAX'] + 20
               else C['blue'])

        v1 = (sh - el).astype(float)
        v2 = (wr - el).astype(float)
        arc_angle(frame, el, v1, v2, angle, col, radius=30)

        label_offset = (-60, -18) if side == 'L' else (12, -18)
        cv2.putText(frame, f'ELBOW {side}:{angle}°',
                    (el[0] + label_offset[0], el[1] + label_offset[1]),
                    FONT, 0.48, col, 2, AA)

    def _draw_upper_arm_angle(self, frame, sh, el, ua_angle):
        """
        Draw vertical reference line from shoulder downward, then the upper-arm
        line from shoulder to elbow. Label the drift angle between them.
        This is the most critical check for pushdowns.
        """
        T   = self.T
        col = (C['red']    if ua_angle > T['UPPER_ARM_DRIFT_THRESH']
               else C['orange'] if ua_angle > T['UPPER_ARM_DRIFT_THRESH'] * 0.65
               else C['green'])

        # Vertical reference
        v_down = np.array([sh[0], sh[1] + 70])
        cv2.line(frame, tuple(sh), tuple(v_down), C['gray'], 1, AA)

        # Upper arm line
        cv2.line(frame, tuple(sh), tuple(el), col, 3, AA)

        # Arc between vertical and upper arm
        v1 = np.array([0.0, 70.0])              # vertical reference
        v2 = (el - sh).astype(float)
        arc_angle(frame, sh, v1, v2, ua_angle, col, radius=22)

        # Label
        mid = ((sh[0] + el[0]) // 2, (sh[1] + el[1]) // 2)
        cv2.putText(frame, f'UA:{ua_angle}°',
                    (mid[0] + 8, mid[1]), FONT, 0.44, col, 2, AA)
        cv2.putText(frame, f'[<{T["UPPER_ARM_DRIFT_THRESH"]}°]',
                    (mid[0] + 8, mid[1] + 18), FONT, 0.34, C['gray'], 1, AA)

    def _draw_torso_angle(self, frame, sh, hip, lean):
        T   = self.T
        col = (C['red']    if lean > T['LEAN_MAX']
               else C['orange'] if lean < T['LEAN_MIN']
               else C['green'])

        cv2.line(frame, tuple(sh), tuple(hip), col, 3, AA)

        v_down  = np.array([0.0, 60.0])
        v_torso = (hip - sh).astype(float)
        arc_angle(frame, sh, v_down, v_torso, lean, col, radius=20)

        mid_x = (sh[0] + hip[0]) // 2
        mid_y = (sh[1] + hip[1]) // 2
        cv2.putText(frame, f'LEAN:{lean}°',
                    (mid_x + 8, mid_y), FONT, 0.42, col, 2, AA)
        cv2.putText(frame, f'[{T["LEAN_MIN"]}–{T["LEAN_MAX"]}°]',
                    (mid_x + 8, mid_y + 18), FONT, 0.32, C['gray'], 1, AA)

    def _draw_wrist_line(self, frame, el, wr, dev_ratio, T):
        col = (C['red']    if dev_ratio > T['WRIST_DEV_THRESH']
               else C['orange'] if dev_ratio > T['WRIST_DEV_THRESH'] * 0.65
               else C['lime'])
        cv2.line(frame, tuple(el), tuple(wr), col, 4, AA)
        cv2.putText(frame, f'WR:{dev_ratio:.2f}',
                    (wr[0] + 8, wr[1] + 6), FONT, 0.36, col, 1, AA)

    def _draw_head_line(self, frame, ear, sh, head_angle):
        col = (C['red']    if head_angle > self.T['HEAD_FWD_THRESH']
               else C['green'])
        cv2.line(frame, tuple(sh), tuple(ear), col, 2, AA)
        cv2.putText(frame, f'HEAD:{head_angle}°',
                    (ear[0] + 6, ear[1] - 8), FONT, 0.38, col, 1, AA)

    def _draw_hud(self, frame, fw, state, elbow_angle, upper_arm_angle, torso_lean):
        """Top-left HUD: phase, mode, rep counters, key angle readings."""
        phase_txt = {
            's1': 'START  (TOP — ARM BENT)',
            's2': 'MOVING',
            's3': 'LOCKOUT  (FULL EXTENSION)',
        }.get(state, '---')
        p_col = {
            's1': (0, 90, 160),
            's2': (0, 120, 60),
            's3': (0, 160, 0),
        }.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)

        att_txt  = self.T['ATTACHMENT'].upper() + ' ATTACHMENT'
        mode_txt = self.T['MODE'].upper()
        lbl(frame, f'{att_txt} · {mode_txt}  ·  ELBOW {elbow_angle}°  ·  UA {upper_arm_angle}°  ·  LEAN {torso_lean}°',
            30, 62, scale=0.38, bg=(55, 55, 55))

        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw * 0.68), 84, bg=(180, 20, 20))

        T = self.T
        ext_col = C['green'] if elbow_angle >= T['ELBOW_LOCKOUT_MIN'] else C['orange']
        ua_col  = C['green'] if upper_arm_angle <= T['UPPER_ARM_DRIFT_THRESH'] else C['red']

        lbl(frame, f'TARGET EXTENSION > {T["ELBOW_LOCKOUT_MIN"]}° | NOW {elbow_angle}°',
            30, 90, scale=0.42, bg=C['dark'], fg=ext_col)
        lbl(frame, f'UPPER ARM DRIFT < {T["UPPER_ARM_DRIFT_THRESH"]}° | NOW {upper_arm_angle}°',
            30, 116, scale=0.42, bg=C['dark'], fg=ua_col)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 142,
                scale=0.46, bg=(180, 20, 20))

    def _draw_feedback(self, frame):
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.52,
                    fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        lbl(frame, 'PUSHDOWN ANALYZER NEEDS SIDE VIEW — ROTATE 90°',
            30, fh - 55, scale=0.54, bg=(180, 80, 20), pad=10)
        self.voice.say('camera_front')
        if self.flip:
            frame = cv2.flip(frame, 1)

    def _no_person(self, frame, fw):
        now = time.perf_counter()
        self.S['inactive'] += now - self.S['last_t']
        self.S['last_t']    = now
        if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
            self.S['correct']   = 0
            self.S['incorrect'] = 0
            self.S['inactive']  = 0.0
            self.voice.say('reset')
        lbl(frame, 'NO PERSON DETECTED', 30, 34, bg=C['dark'])
        if self.flip:
            frame = cv2.flip(frame, 1)


# ══════════════════════════════════════════════════════════════════════
#  MEDIAPIPE
# ══════════════════════════════════════════════════════════════════════

def make_pose():
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.62,
        min_tracking_confidence=0.62,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='AI Tricep Pushdown Analyzer')
    ap.add_argument('--video',      default=None,
                    help='Path to video file (omit for webcam)')
    ap.add_argument('--mode',       default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--attachment', default='bar',
                    choices=['bar', 'rope'],
                    help='Cable attachment type (default: bar)')
    ap.add_argument('--flip',       action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',       action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',      type=int, default=5,
                    help='Speech speed 1–10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode, args.attachment)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = TricepPushdownProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    att_desc = {
        'bar' : 'STRAIGHT BAR   — wrists neutral, elbows tight',
        'rope': 'ROPE           — slight outward flare OK at bottom',
    }[args.attachment]

    print(f"\n💪  Tricep Pushdown Analyzer  [{args.mode.upper()}]")
    print(f"    Attachment : {att_desc}")
    print(f"    Camera     : SIDE VIEW — rotate 90° so camera sees your profile")
    print(f"    Setup      : Stand facing the cable stack, side to camera")
    print(f"                 Elbows pinned to sides, slight forward lean")
    print("    Press      Q  to quit\n")
    print("  Form checks active:")
    print("    ✓ Upper arm drift      (elbows swinging forward — #1 cheat)")
    print("    ✓ Elbow flare          (elbows spreading outward)")
    print("    ✓ Incomplete extension (not pushing to full lockout)")
    print("    ✓ Bodyweight lean      (too much forward lean / cheating)")
    print("    ✓ Wrist alignment      (wrists breaking under load)")
    print("    ✓ Shoulder elevation   (shrugging / traps taking load)")
    print("    ✓ Head position        (craning neck forward)")
    print("    ✓ Partial start return (not returning to full start position)\n")
    print(f"  Thresholds [{args.mode}]:")
    print(f"    Start (top) when elbow ≤ {T['ELBOW_START_MAX']}°")
    print(f"    Lockout when elbow ≥ {T['ELBOW_LOCKOUT_MIN']}°")
    print(f"    Rep counts when extension ≥ {T['ELBOW_GOOD_LOCKOUT']}°")
    print(f"    Upper arm max drift: {T['UPPER_ARM_DRIFT_THRESH']}° from vertical")
    print(f"    Torso lean target: {T['LEAN_MIN']}–{T['LEAN_MAX']}°\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Tricep Pushdown Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        print(f"\n── Session Results ──────────────────")
        print(f"  ✅  Correct   : {proc.S['correct']}")
        print(f"  ❌  Incorrect : {proc.S['incorrect']}")


if __name__ == '__main__':
    main()