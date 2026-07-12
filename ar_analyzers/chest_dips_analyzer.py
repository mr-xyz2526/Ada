"""
AI Fitness Trainer - Chest Dips Analyzer  (v1)
===============================================
Install:  pip install opencv-python mediapipe numpy pyttsx3

Run:
    python chest_dips_analyzer.py
    python chest_dips_analyzer.py --mode pro
    python chest_dips_analyzer.py --grip wide      # wide grip (more chest)
    python chest_dips_analyzer.py --grip shoulder  # shoulder-width (balanced)
    python chest_dips_analyzer.py --flip --mute
    python chest_dips_analyzer.py --speed 7        # speech speed 1-10 (default 5)
    python chest_dips_analyzer.py --video clip.mp4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠  CAMERA SETUP: SIDE VIEW (90° to the right or left of you).
     Camera at roughly hip/waist height, full body in frame.
     This captures the torso lean, arm descent, and elbow angle.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What it detects (8 simultaneous form checks):
  1.  Elbow flare        — elbows pointing outward instead of back/diagonal
  2.  Shallow depth      — not descending low enough (< 90° at elbow)
  3.  Incomplete lockout — not pressing fully up at the top
  4.  Forward lean angle — checks torso lean is correct for chest emphasis
  5.  Wrist alignment    — wrists collapsing or over-extending
  6.  Head position      — chin tucked or head thrown back (neck strain)
  7.  Hip/knee swing     — kipping using legs (momentum, not chest)
  8.  Shoulder elevation — shrugging at the top (traps firing instead of chest)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CHEST DIP GEOMETRY (SIDE VIEW)
  ──────────────────────────────────────────────────────────────────────
  PRIMARY SIGNAL: elbow_angle = joint_angle(shoulder, elbow, wrist)
    This is the key depth indicator. Measured on the visible side arm.

    s1  LOCKOUT   : elbow_angle > ELBOW_LOCKOUT_MIN  (~160–180°, arms extended)
    s2  DESCENDING: elbow_angle between LOCKOUT and BOTTOM
    s3  BOTTOM    : elbow_angle < ELBOW_BOTTOM_MAX   (~70–90°, full depth)

  Rep sequence: s1 → s2 → s3 → s2 → s1

  SECONDARY SIGNALS:
  ──────────────────
  torso_angle = vert_angle(shoulder_mid, hip_mid)
    Ideal chest-dip forward lean: 20–40° from vertical.
    Tricep dip = near vertical (0–15°). Too much lean = shoulder injury risk.
    Measured from the side: uses shoulder and hip midpoints.

  elbow_flare = horizontal distance between elbows (front view estimate)
    In side view: estimated from the z-depth component of both elbows.
    Flared elbows = external rotation, reduces chest activation.
    Both elbows should track in the same plane (no flare outward).

  hip_swing = change in hip_x from lockout baseline
    Swinging hips forward/backward to generate momentum.
    Threshold: > 5% frame width from baseline.

  sh_elevation = shoulder y vs baseline at lockout
    Shoulders shrugging at top. Baseline captured at s1.
    Threshold: > 3.5% frame height upward from baseline.

  wrist_deviation = lateral displacement of wrist from elbow projection
    Wrist should stay stacked under elbow throughout the movement.
    Excessive wrist deviation = instability / joint strain.

  head_tilt = joint_angle(shoulder, ear, nose-vertical-proj)
    Head should be neutral. Tilted back excessively (hyperextension)
    or chin dramatically tucked both indicate poor cervical alignment.

  GRIP WIDTH MODES:
  ─────────────────
  wide     : torso_angle target 25–40°, more chest stretch expected
  shoulder : torso_angle target 15–30°, balanced chest/tricep split
  ──────────────────────────────────────────────────────────────────────
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
        'camera_side'    : "Face the camera to your side. The camera should see your profile.",
        'camera_front'   : "You are facing the camera. Rotate 90 degrees so the camera sees your side.",
        'reset'          : "Session reset. Whenever you are ready.",
        'get_ready'      : "Arms locked out. Slight forward lean. Cross your feet. Brace your core.",
        # ── phase coaching ────────────────────────────────────────────
        'descending'     : "Control the descent. Lean forward slightly. Elbows tracking back.",
        'halfway_down'   : "Halfway. Keep going deeper. Elbows behind you.",
        'at_bottom'      : "Full depth! Hold for a beat. Feel the chest stretch.",
        'pressing_up'    : "Drive up. Push the bars away. Squeeze your chest at the top.",
        'at_top'         : "Full lockout. Set for the next rep.",
        # ── rep results ───────────────────────────────────────────────
        'good_rep'       : "Good rep!",
        'no_depth'       : "Too shallow. Go lower until your elbows reach 90 degrees.",
        'no_lockout'     : "Incomplete lockout. Press all the way up to straight arms.",
        'bad_form_rep'   : "Form error — rep not counted. Reset and focus.",
        # ── form errors ───────────────────────────────────────────────
        'elbow_flare'    : "Elbows flaring out! Point them backward, not sideways.",
        'shallow'        : "Go deeper! Lower until upper arm is parallel to the floor.",
        'no_lock'        : "Fully lock out your arms at the top. Press all the way up.",
        'lean_too_much'  : "Too much forward lean! Straighten up slightly — you will strain your shoulders.",
        'lean_too_little': "Lean forward more for chest emphasis. Body more than 15 degrees.",
        'wrist_break'    : "Wrists buckling! Keep them straight and stacked under your elbows.",
        'head_back'      : "Head neutral! Do not throw your head back.",
        'hip_swing'      : "Stop swinging your legs! Keep them still or crossed.",
        'shrug'          : "Shoulders rising! Depress your shoulder blades. Pack them down.",
        # ── milestone counts ──────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Chest is loading!",
        '5'  : "5 reps. Keep going!",
        '10' : "10 reps. Excellent chest work!",
        '15' : "15 reps. You are incredibly strong!",
        '20' : "20 reps. Elite level!",
    }

    _COOLDOWN = {
        'camera_side'    : 7.0,
        'camera_front'   : 7.0,
        'reset'          : 5.0,
        'get_ready'      : 6.0,
        'descending'     : 2.5,
        'halfway_down'   : 2.0,
        'at_bottom'      : 2.0,
        'pressing_up'    : 2.5,
        'at_top'         : 2.0,
        'good_rep'       : 1.5,
        'no_depth'       : 3.5,
        'no_lockout'     : 3.5,
        'bad_form_rep'   : 3.5,
        'elbow_flare'    : 4.5,
        'shallow'        : 4.5,
        'no_lock'        : 4.5,
        'lean_too_much'  : 4.0,
        'lean_too_little': 4.0,
        'wrist_break'    : 4.0,
        'head_back'      : 4.0,
        'hip_swing'      : 4.0,
        'shrug'          : 4.5,
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

def get_thresholds(mode: str = 'beginner', grip: str = 'shoulder') -> dict:
    """
    Chest Dip Thresholds.

    elbow_angle    = joint_angle(shoulder, elbow, wrist)  — PRIMARY depth signal
      LOCKOUT : > ELBOW_LOCKOUT_MIN  (160–180°)
      BOTTOM  : < ELBOW_BOTTOM_MAX   (70–90°)

    torso_angle    = vert_angle(shoulder_mid, hip_mid)    — forward lean check
    elbow_flare    = estimated from 3D z-depth difference of elbows
    hip_swing_x    = normalized horizontal hip movement from s1 baseline
    sh_elevation   = normalized shoulder y-rise from s1 baseline
    wrist_deviation= lateral wrist deviation from elbow line
    head_angle     = joint_angle(ear, shoulder, vertical-ref)
    """
    if mode == 'pro':
        base = {
            # Depth gating
            'ELBOW_LOCKOUT_MIN' : 158,   # above this = s1 (LOCKOUT)
            'ELBOW_BOTTOM_MAX'  :  82,   # below this = s3 (BOTTOM)
            'ELBOW_GOOD_BOTTOM' :  85,   # must reach this for rep to count
            # Torso lean
            'LEAN_MIN'          :  18,   # degrees from vertical (too upright)
            'LEAN_MAX'          :  42,   # degrees from vertical (too much lean)
            # Form thresholds
            'FLARE_THRESH'      :  28,   # max elbow z-diff normalized (degrees equiv)
            'FLARE_FRAMES'      :   4,   # consecutive frames before flagging
            'HIP_SWING_THRESH'  : 0.040, # fraction of frame width hip can drift
            'SH_ELEV_THRESH'    : 0.030, # fraction of frame height shoulder can rise
            'WRIST_DEV_THRESH'  : 0.040, # fraction of arm length wrist can deviate
            'HEAD_BACK_THRESH'  :  38,   # ear-shoulder-vertical angle (head tilt back)
            'LOCKOUT_MIN'       : 155,   # minimum elbow angle to count as lockout
            # State smoothing
            'ELBOW_HIST'        :   6,   # smoothing window for elbow angle (frames)
            'HIP_HIST'          :   4,   # smoothing for hip position
            'SIDE_VIS_THRESH'   : 0.25,  # side-view detection: vis diff threshold
            'FRONT_SPAN_THRESH' : 0.22,  # shoulder span / frame width below = side view OK
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         :   4,
        }
    else:  # beginner
        base = {
            'ELBOW_LOCKOUT_MIN' : 152,
            'ELBOW_BOTTOM_MAX'  :  90,
            'ELBOW_GOOD_BOTTOM' :  95,
            'LEAN_MIN'          :  12,
            'LEAN_MAX'          :  48,
            'FLARE_THRESH'      :  36,
            'FLARE_FRAMES'      :   5,
            'HIP_SWING_THRESH'  : 0.055,
            'SH_ELEV_THRESH'    : 0.045,
            'WRIST_DEV_THRESH'  : 0.055,
            'HEAD_BACK_THRESH'  :  44,
            'LOCKOUT_MIN'       : 148,
            'ELBOW_HIST'        :   6,
            'HIP_HIST'          :   4,
            'SIDE_VIS_THRESH'   : 0.30,
            'FRONT_SPAN_THRESH' : 0.28,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         :   5,
        }

    # Grip-width adjustments
    # Wide grip: expect more forward lean for chest emphasis
    # Shoulder grip: neutral lean range
    if grip == 'wide':
        base['LEAN_MIN'] = max(10, base['LEAN_MIN'] + 5)
        base['LEAN_MAX'] = min(55, base['LEAN_MAX'] + 5)
        base['GRIP_WIDTH'] = 'wide'
    else:
        base['GRIP_WIDTH'] = 'shoulder'

    base['MODE'] = mode
    return base


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY HELPERS  (identical signatures to cable_fly_analyzer)
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3) -> int:
    """Angle at p2 between vectors p2→p1 and p2→p3. Returns 0–180°."""
    v1  = (p1 - p2).astype(float)
    v2  = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot) -> int:
    """Angle of segment p_top→p_bot from vertical. 0° = upright."""
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


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
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r), color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),   color, -1)
    cv2.rectangle(img, (x1,   y1+r), (x1+r, y2-r), color, -1)
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


def depth_bar(frame, fw, fh, elbow_angle, lockout_min, bottom_max):
    """
    Vertical progress bar on the right edge showing dip depth.
    Top = lockout (extended), Bottom = full depth (90°).
    Green zone = bottom target. Colour-fills based on current depth.
    """
    bx, by = fw - 38, 60
    bh     = int(fh * 0.50)   # half screen height
    bw     = 20

    # Normalise: 180° (lockout) → top of bar, 60° (below target) → bottom
    full_range  = float(lockout_min - 60)
    current_pct = np.clip(1.0 - (elbow_angle - 60) / full_range, 0.0, 1.0)
    bottom_pct  = np.clip(1.0 - (bottom_max  - 60) / full_range, 0.0, 1.0)

    # Background
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (35, 35, 35), -1)

    # Target zone (green band)
    t_y1 = int(by + bottom_pct * bh)
    t_y2 = min(by + bh, t_y1 + int(bh * 0.18))
    cv2.rectangle(frame, (bx, t_y1), (bx+bw, t_y2), (0, 60, 20), -1)

    # Filled progress
    fill_h  = int(current_pct * bh)
    fill_y  = by + bh - fill_h
    fill_col = (
        (0, 200, 80)   if elbow_angle <= bottom_max   else   # full depth — green
        (0, 200, 200)  if elbow_angle <= lockout_min  else   # mid range — yellow
        (60, 80, 220)                                          # lockout zone — blue
    )
    if fill_h > 0:
        cv2.rectangle(frame, (bx, fill_y), (bx+bw, by+bh), fill_col, -1)

    # Border
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (80, 80, 80), 1)

    # Labels
    cv2.putText(frame, 'TOP',  (bx - 2, by - 6),      FONT, 0.32, C['gray'], 1, AA)
    cv2.putText(frame, 'BOT',  (bx - 2, by + bh + 14),FONT, 0.32, C['gray'], 1, AA)

    # Tick mark at target depth
    cv2.line(frame, (bx - 6, t_y1), (bx, t_y1), C['green'], 2, AA)
    cv2.putText(frame, f'{bottom_max}°', (bx - 36, t_y1 + 4), FONT, 0.30, C['green'], 1, AA)

    # Current angle label beside bar
    bar_cur_y = int(by + bh - fill_h)
    cv2.putText(frame, f'{elbow_angle}°',
                (bx - 40, bar_cur_y + 5), FONT, 0.38, fill_col, 1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS  idx → (label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('ELBOWS FLARING — POINT THEM BACK',        130, (30,  50, 210), 'elbow_flare'),
    1: ('TOO SHALLOW — LOWER UNTIL 90° AT ELBOW',  178, (30,  50, 210), 'shallow'),
    2: ('LOCK OUT — PRESS ARMS FULLY STRAIGHT',    226, (30,  50, 210), 'no_lock'),
    3: ('LEAN FORWARD MORE — CHEST DIP, NOT TRICEP',274,(20, 100,  20), 'lean_too_little'),
    4: ('REDUCE LEAN — SHOULDER STRAIN RISK',       322, (180, 40,  40), 'lean_too_much'),
    5: ('WRISTS BREAKING — KEEP THEM STRAIGHT',    370, (180, 40, 180), 'wrist_break'),
    6: ('STOP SWINGING — KEEP LEGS STILL',         418, (180, 40,  40), 'hip_swing'),
    7: ('SHOULDERS RISING — PACK THEM DOWN',       466, (180, 40,  40), 'shrug'),
}

# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES  (same MediaPipe pose as cable_fly_analyzer)
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
#  ─────────────────────────────────────────────────────────────────────
#  In side view, one arm is visible and one is occluded.
#  We pick the arm with HIGHER average landmark visibility
#  so all measurements use the cleaner signal.
# ══════════════════════════════════════════════════════════════════════

def pick_visible_side(lm):
    """
    Returns 'L' or 'R': whichever side has better landmark visibility.
    For dips in side view, the near arm is always more reliable.
    """
    l_vis = (lm[LM['l_sh']].visibility + lm[LM['l_el']].visibility +
             lm[LM['l_wr']].visibility + lm[LM['l_hip']].visibility) / 4
    r_vis = (lm[LM['r_sh']].visibility + lm[LM['r_el']].visibility +
             lm[LM['r_wr']].visibility + lm[LM['r_hip']].visibility) / 4
    return 'L' if l_vis >= r_vis else 'R'


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class ChestDipProcessor:

    def __init__(self, T: dict, flip: bool = False, voice: VoiceCoach = None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        # Smoothing buffers — elbow angle jitter is the primary noise source
        self._el_hist    = collections.deque(maxlen=T['ELBOW_HIST'])
        self._hip_hist   = collections.deque(maxlen=T['HIP_HIST'])
        self._lean_hist  = collections.deque(maxlen=4)

        # Baselines captured at s1 (lockout) — used for deviation checks
        self._hip_x_baseline:  float | None = None
        self._sh_y_baseline:   float | None = None
        self._trunk_baseline:  float | None = None

        # Best values in current rep
        self._best_bottom:   int   = 999   # min elbow angle seen (deepest point)
        self._best_lockout:  int   = 0     # max elbow angle seen (highest point)

        # Camera check counter
        self._cam_front_cnt: int = 0

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
            last_state_inact     = None,

            # Which side is currently being tracked (updated each frame)
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
        # Chest dips NEED side view. Detect front-facing:
        # shoulder span very wide in pixels AND both shoulders equally visible.
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

        # ── Select best visible side each frame ───────────────────────
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

        # ── 1. Elbow angle — PRIMARY DEPTH SIGNAL ────────────────────
        #    joint_angle(shoulder, elbow, wrist)
        #    LOCKOUT : ~160–180°   BOTTOM : ~60–90°
        raw_elbow = joint_angle(sh_px, el_px, wr_px)
        self._el_hist.append(raw_elbow)
        elbow_angle = int(np.mean(self._el_hist))

        # Track best values this rep
        self._best_bottom  = min(self._best_bottom,  elbow_angle)
        self._best_lockout = max(self._best_lockout, elbow_angle)

        # ── 2. Torso lean — FORWARD LEAN CHECK ───────────────────────
        #    vert_angle(shoulder_midpoint, hip_midpoint) from vertical.
        #    SIDE VIEW: we use the single visible side shoulder & hip.
        #    A line from shoulder down to hip. The more forward the torso,
        #    the greater the angle from vertical.
        sh_mid_px  = midpoint_px(l_sh,  r_sh)
        hip_mid_px = midpoint_px(l_hip, r_hip)
        raw_lean   = vert_angle(sh_px, hip_px)
        self._lean_hist.append(raw_lean)
        torso_lean = int(np.mean(self._lean_hist))

        # ── 3. Elbow flare — Z-DEPTH DIFFERENCE ──────────────────────
        #    MediaPipe z is depth relative to the hip midpoint (negative = closer).
        #    Both elbows at the same z-depth = no flare.
        #    Large z-difference in side view → one elbow is farther forward (flare).
        #    We convert z-diff to an approximate angle using shoulder width as scale.
        sh_width_n   = max(abs(n_lsh[0] - n_rsh[0]), 0.04)
        el_z_diff    = abs(float(n_lel[2]) - float(n_rel[2]))
        # Normalise: convert z-diff to degrees equivalent
        flare_angle  = int(np.degrees(np.arctan2(el_z_diff, sh_width_n + 1e-9)))

        # ── 4. Hip swing — HORIZONTAL HIP DRIFT ──────────────────────
        #    In side view, hip x-position should stay stable.
        #    Large x-drift → kipping / using momentum.
        raw_hip_x = float(n_hip[0])
        self._hip_hist.append(raw_hip_x)
        hip_x_smooth = float(np.mean(self._hip_hist))

        # ── 5. Wrist deviation — WRIST STACKED UNDER ELBOW ───────────
        #    Project elbow → wrist direction.
        #    Measure lateral (horizontal) deviation of wrist from the elbow plumb.
        #    In side view: wrist x should roughly follow elbow x.
        wrist_dev_n = abs(float(n_wr[0]) - float(n_el[0]))
        arm_len_n   = arm_length_n(n_sh, n_el, n_wr)
        wrist_dev_ratio = wrist_dev_n / (arm_len_n + 1e-9)

        # ── 6. Head angle — NECK/HEAD TILT ────────────────────────────
        #    joint_angle(ear, shoulder, virtual-point-directly-below-shoulder)
        #    i.e. how much the head is thrown back vs neutral.
        v_below_sh = np.array([sh_px[0], sh_px[1] + 60])
        head_angle = joint_angle(ear_px, sh_px, v_below_sh)

        # ── 7. Shoulder elevation — SHRUG DETECTION ───────────────────
        sh_y_n = float(n_sh[1])   # normalised y (increases downward)

        # ── Determine state ───────────────────────────────────────────
        state = self._state(elbow_angle)

        # Capture baselines at LOCKOUT (s1) before each rep
        if state == 's1' and not self.S['seq']:
            self._hip_x_baseline  = hip_x_smooth
            self._sh_y_baseline   = sh_y_n
            self._trunk_baseline  = torso_lean

        # ══════════════════════════════════════════════════════════════
        #  FORM CHECKS  (8 simultaneous, debounced over FB_FRAMES)
        # ══════════════════════════════════════════════════════════════
        bad   = np.zeros(8, bool)
        T     = self.T
        in_rep = state != 's1' or len(self.S['seq']) > 0

        if in_rep:

            # [0] Elbow flare — elbows pointing outward
            #     Detected via z-depth difference of elbows.
            if flare_angle > T['FLARE_THRESH']:
                bad[0] = True

            # [1] Shallow depth — not reaching 90° at elbow
            #     Only check during descent / at bottom
            if state in ('s2', 's3') and elbow_angle > T['ELBOW_GOOD_BOTTOM']:
                bad[1] = True

            # [2] Incomplete lockout — not pressing fully up
            #     Only check at top phase
            if state == 's1' and elbow_angle < T['LOCKOUT_MIN']:
                bad[2] = True

            # [3] Too little lean — upright (tricep dip, not chest dip)
            if torso_lean < T['LEAN_MIN']:
                bad[3] = True

            # [4] Too much lean — shoulder injury risk
            if torso_lean > T['LEAN_MAX']:
                bad[4] = True

            # [5] Wrist deviation — wrists buckling
            if wrist_dev_ratio > T['WRIST_DEV_THRESH']:
                bad[5] = True

            # [6] Hip swing — kipping / momentum
            if (self._hip_x_baseline is not None
                    and abs(hip_x_smooth - self._hip_x_baseline) > T['HIP_SWING_THRESH']):
                bad[6] = True

            # [7] Shoulder elevation — shrugging at top
            if (self._sh_y_baseline is not None
                    and self._sh_y_baseline - sh_y_n > T['SH_ELEV_THRESH']):
                bad[7] = True

        # Invalidate rep on movement errors (not depth quality checks)
        if any(bad[[0, 4, 5, 6, 7]]):
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
            seq          = self.S['seq']
            full_rep     = 's3' in seq
            bad_depth    = (self._best_bottom > T['ELBOW_GOOD_BOTTOM'])
            bad_lockout  = (self._best_lockout < T['LOCKOUT_MIN'])

            if full_rep and not self.S['bad_form'] and not bad_depth:
                if bad_lockout:
                    self.S['incorrect'] += 1
                    self.voice.say('no_lockout')
                    print(f"⚠   Rep — incomplete lockout (best {self._best_lockout}°)")
                else:
                    self.S['correct'] += 1
                    n   = self.S['correct']
                    key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                    self.voice.say_now(key)
                    print(f"✅  Rep #{n} — correct  "
                          f"[bottom={self._best_bottom}°, top={self._best_lockout}°]")
            elif full_rep and bad_depth and not self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('no_depth')
                print(f"❌  Shallow rep — deepest angle was {self._best_bottom}°"
                      f" (target < {T['ELBOW_GOOD_BOTTOM']}°)")
            elif not full_rep and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.voice.say('no_depth')
                print(f"❌  Did not reach bottom phase")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")

            # Reset for next rep
            self.S['seq']             = []
            self.S['bad_form']        = False
            self.S['halfway_said']    = False
            self._hip_x_baseline      = None
            self._sh_y_baseline       = None
            self._trunk_baseline      = None
            self._best_bottom         = 999
            self._best_lockout        = 0

        self.S['prev_state'] = state

        # ── Inactivity reset ─────────────────────────────────────────
        now = time.perf_counter()
        if state == self.S['last_state_inact']:
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']        = 0.0
            self.S['last_state_inact'] = state
        self.S['last_t'] = now

        # ── Draw all overlays ─────────────────────────────────────────
        self._draw_skeleton(frame,
                            l_sh, r_sh, l_el, r_el, l_wr, r_wr,
                            l_hip, r_hip, l_kn, r_kn, l_ank, r_ank,
                            l_ear, r_ear, nose)
        self._draw_elbow_arc(frame, sh_px, el_px, wr_px, elbow_angle, side)
        self._draw_torso_angle(frame, sh_px, hip_px, torso_lean)
        self._draw_wrist_line(frame, el_px, wr_px, wrist_dev_ratio, T)
        self._draw_head_line(frame, ear_px, sh_px, head_angle)
        depth_bar(frame, fw, fh, elbow_angle,
                  T['ELBOW_LOCKOUT_MIN'], T['ELBOW_BOTTOM_MAX'])
        self._draw_hud(frame, fw, state, elbow_angle, torso_lean)
        self._draw_feedback(frame)

        # Debug strip
        cv2.putText(frame,
            f'EL:{elbow_angle}°  LEAN:{torso_lean}°  FLARE:{flare_angle}°'
            f'  WRIST_DEV:{wrist_dev_ratio:.3f}  HIP_X:{hip_x_smooth:.3f}'
            f'  HEAD:{head_angle}°  SIDE:{side}',
            (10, fh - 10), FONT, 0.27, C['gray'], 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, elbow_angle: int) -> str:
        """
        Three states driven by elbow angle:
          s1  LOCKOUT      elbow_angle > ELBOW_LOCKOUT_MIN  (~160°+)
          s3  BOTTOM       elbow_angle < ELBOW_BOTTOM_MAX   (~80-90°)
          s2  MOVING       everything in between

        Hysteresis is achieved naturally via the smoothing buffer.
        """
        if elbow_angle >= self.T['ELBOW_LOCKOUT_MIN']: return 's1'
        if elbow_angle <= self.T['ELBOW_BOTTOM_MAX']:  return 's3'
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

        # Mid-descent cue: halfway between lockout and bottom
        halfway_angle = (self.T['ELBOW_LOCKOUT_MIN'] + self.T['ELBOW_BOTTOM_MAX']) // 2
        if (state == 's2'
                and 's3' not in self.S['seq']
                and elbow_angle <= halfway_angle
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
        """
        Full body skeleton.
        Arms = GOLD (primary movers).
        Torso = light blue.
        Legs = cyan.
        Head/neck = white.
        """
        lw = 3
        # Torso box
        sh_mid  = midpoint_px(l_sh,  r_sh)
        hip_mid = midpoint_px(l_hip, r_hip)
        cv2.line(frame, tuple(sh_mid),  tuple(hip_mid), C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_sh),    tuple(r_sh),    C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_hip),   tuple(r_hip),   C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_sh),    tuple(l_hip),   C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(r_sh),    tuple(r_hip),   C['lt_blue'], lw, AA)

        # Legs
        for a, b in [(l_hip, l_kn), (l_kn, l_ank),
                     (r_hip, r_kn), (r_kn, r_ank)]:
            cv2.line(frame, tuple(a), tuple(b), C['cyan'], lw, AA)

        # ── Arms (gold) ──────────────────────────────────────────────
        for a, b in [(l_sh, l_el), (l_el, l_wr),
                     (r_sh, r_el), (r_el, r_wr)]:
            cv2.line(frame, tuple(a), tuple(b), C['gold'], lw + 2, AA)

        # ── Head / neck ──────────────────────────────────────────────
        ear_mid = midpoint_px(l_ear, r_ear)
        cv2.line(frame, tuple(sh_mid), tuple(ear_mid), C['white'], lw, AA)
        cv2.line(frame, tuple(ear_mid), tuple(nose),   C['white'], lw, AA)

        # ── Joints ───────────────────────────────────────────────────
        # Shoulder & hip joints
        for pt in (l_sh, r_sh, l_hip, r_hip):
            cv2.circle(frame, tuple(pt), 7,  C['lt_blue'], -1, AA)
            cv2.circle(frame, tuple(pt), 7,  C['white'],    1, AA)
        # Elbow & wrist (primary — larger, outlined)
        for pt in (l_el, r_el, l_wr, r_wr):
            cv2.circle(frame, tuple(pt), 9,  C['gold'],    -1, AA)
            cv2.circle(frame, tuple(pt), 9,  C['white'],    2, AA)
        # Leg joints
        for pt in (l_kn, r_kn, l_ank, r_ank):
            cv2.circle(frame, tuple(pt), 5,  C['cyan'],    -1, AA)
        # Head
        cv2.circle(frame, tuple(nose),    7, C['white'],   -1, AA)
        cv2.circle(frame, tuple(l_ear),   5, C['gray'],    -1, AA)
        cv2.circle(frame, tuple(r_ear),   5, C['gray'],    -1, AA)

    def _draw_elbow_arc(self, frame, sh, el, wr, angle, side):
        """
        Draw the elbow angle arc on the visible arm.
        Colour encodes depth progress:
          red    = too bent above target — actually not relevant; here we want BEND.
          green  = at target depth (< ELBOW_BOTTOM_MAX)
          orange = mid-range
          blue   = extended / at lockout
        """
        T   = self.T
        col = (C['green']  if angle <= T['ELBOW_BOTTOM_MAX']
               else C['orange'] if angle <= T['ELBOW_LOCKOUT_MIN'] - 20
               else C['blue'])

        v1 = (sh - el).astype(float)
        v2 = (wr - el).astype(float)
        arc_angle(frame, el, v1, v2, angle, col, radius=28)

        # Label beside the elbow
        label_offset = (-55, -15) if side == 'L' else (10, -15)
        cv2.putText(frame, f'ELBOW {side}:{angle}°',
                    (el[0] + label_offset[0], el[1] + label_offset[1]),
                    FONT, 0.46, col, 2, AA)

    def _draw_torso_angle(self, frame, sh, hip, lean):
        """
        Torso lean line from shoulder to hip.
        Colour = within target range (green), too much (red), too little (orange).
        """
        T   = self.T
        col = (C['red']    if lean > T['LEAN_MAX']
               else C['orange'] if lean < T['LEAN_MIN']
               else C['green'])

        cv2.line(frame, tuple(sh), tuple(hip), col, 3, AA)

        # Angle arc at shoulder
        v_down  = np.array([0.0, 60.0])              # straight down reference
        v_torso = (hip - sh).astype(float)
        arc_angle(frame, sh, v_down, v_torso, lean, col, radius=24)

        # Label
        mid_x = (sh[0] + hip[0]) // 2
        mid_y = (sh[1] + hip[1]) // 2
        cv2.putText(frame, f'LEAN:{lean}°',
                    (mid_x + 8, mid_y), FONT, 0.44, col, 2, AA)

        # Target range overlay beside label
        cv2.putText(frame, f'[{T["LEAN_MIN"]}–{T["LEAN_MAX"]}°]',
                    (mid_x + 8, mid_y + 18), FONT, 0.34, C['gray'], 1, AA)

    def _draw_wrist_line(self, frame, el, wr, dev_ratio, T):
        """
        Line from elbow to wrist coloured by wrist deviation ratio.
        Green = stable, yellow/orange = drifting, red = broken.
        """
        col = (C['red']    if dev_ratio > T['WRIST_DEV_THRESH']
               else C['orange'] if dev_ratio > T['WRIST_DEV_THRESH'] * 0.65
               else C['lime'])
        cv2.line(frame, tuple(el), tuple(wr), col, 4, AA)

        # Small label beside wrist
        cv2.putText(frame, f'WR:{dev_ratio:.2f}',
                    (wr[0] + 8, wr[1] + 6), FONT, 0.36, col, 1, AA)

    def _draw_head_line(self, frame, ear, sh, head_angle):
        """
        Line from shoulder to ear, labelled with head angle.
        """
        col = (C['red']    if head_angle > self.T['HEAD_BACK_THRESH']
               else C['green'])
        cv2.line(frame, tuple(sh), tuple(ear), col, 2, AA)
        cv2.putText(frame, f'HEAD:{head_angle}°',
                    (ear[0] + 6, ear[1] - 8), FONT, 0.38, col, 1, AA)

    def _draw_hud(self, frame, fw, state, elbow_angle, torso_lean):
        """Top-left HUD: phase, mode, rep counters, depth status."""
        phase_txt = {
            's1': 'LOCKOUT  (TOP)',
            's2': 'MOVING',
            's3': 'BOTTOM  (FULL DEPTH)',
        }.get(state, '---')
        p_col = {
            's1': (0, 90, 160),
            's2': (0, 120, 60),
            's3': (0, 160, 0),
        }.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)

        grip_txt  = self.T['GRIP_WIDTH'].upper() + ' GRIP'
        mode_txt  = self.T['MODE'].upper()
        lbl(frame, f'{grip_txt} · {mode_txt}  ·  ELBOW {elbow_angle}°  ·  LEAN {torso_lean}°',
            30, 62, scale=0.40, bg=(55, 55, 55))

        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw * 0.68), 84, bg=(180, 20, 20))

        # Target ranges row
        T = self.T
        depth_col = C['green'] if elbow_angle <= T['ELBOW_BOTTOM_MAX'] else C['orange']
        lean_col  = (C['green'] if T['LEAN_MIN'] <= torso_lean <= T['LEAN_MAX']
                     else C['red'])
        lbl(frame, f'TARGET DEPTH < {T["ELBOW_BOTTOM_MAX"]}° | NOW {elbow_angle}°',
            30, 90, scale=0.42, bg=C['dark'], fg=depth_col)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 112,
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
        """Front-view camera detected. Dips need side view."""
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        lbl(frame, 'CHEST DIPS NEEDS SIDE VIEW — ROTATE 90°',
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
    ap = argparse.ArgumentParser(description='AI Chest Dip Analyzer')
    ap.add_argument('--video', default=None,
                    help='Path to video file (omit for webcam)')
    ap.add_argument('--mode',  default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--grip',  default='shoulder',
                    choices=['wide', 'shoulder'],
                    help='Grip width (default: shoulder)')
    ap.add_argument('--flip',  action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',  action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed', type=int, default=5,
                    help='Speech speed 1–10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode, args.grip)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = ChestDipProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    grip_desc = {
        'wide'    : 'WIDE GRIP     — more chest stretch, target clavicular head',
        'shoulder': 'SHOULDER GRIP — balanced chest / tricep emphasis',
    }[args.grip]

    print(f"\n🏋  Chest Dip Analyzer  [{args.mode.upper()}]")
    print(f"    Grip    : {grip_desc}")
    print(f"    Camera  : SIDE VIEW — rotate 90° so camera sees your profile")
    print(f"    Setup   : Parallel bars, full body visible, slight forward lean")
    print("    Press   Q  to quit\n")
    print("  Form checks active:")
    print("    ✓ Elbow flare          (elbows pointing outward)")
    print("    ✓ Shallow depth        (not reaching 90° at elbow)")
    print("    ✓ Incomplete lockout   (not pressing fully up)")
    print("    ✓ Forward lean angle   (torso lean for chest emphasis)")
    print("    ✓ Wrist alignment      (wrists collapsing / buckling)")
    print("    ✓ Hip / knee swing     (momentum / kipping)")
    print("    ✓ Shoulder elevation   (shrugging at lockout)")
    print("    ✓ Head position        (neck hyperextension)\n")
    print(f"  Thresholds [{args.mode}]:")
    print(f"    Lockout when elbow > {T['ELBOW_LOCKOUT_MIN']}°")
    print(f"    Full depth when elbow < {T['ELBOW_BOTTOM_MAX']}°")
    print(f"    Rep counts when bottom < {T['ELBOW_GOOD_BOTTOM']}°")
    print(f"    Torso lean target: {T['LEAN_MIN']}–{T['LEAN_MAX']}°\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Chest Dip Analyzer — Q to quit', output)
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