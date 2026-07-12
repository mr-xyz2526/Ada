"""
AI Fitness Trainer - Cable Fly Analyzer  (v1)
=============================================
Install:  pip install opencv-python mediapipe numpy pyttsx3

Run:
    python cable_fly_analyzer.py
    python cable_fly_analyzer.py --mode pro
    python cable_fly_analyzer.py --cable high     # high cable fly (upper chest)
    python cable_fly_analyzer.py --cable mid      # mid cable / pec deck height
    python cable_fly_analyzer.py --cable low      # low cable fly (targets upper pec)
    python cable_fly_analyzer.py --flip --mute
    python cable_fly_analyzer.py --speed 7        # speech speed 1-10 (default 5)
    python cable_fly_analyzer.py --video clip.mp4

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠  CAMERA SETUP: FRONT VIEW facing you directly.
     Stand between the cable stacks. Full body visible.
     This is the OPPOSITE of deadlift / shoulder press!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What it detects (7 simultaneous form checks):
  1.  Elbow over-bend     — elbows too bent (pressing not flying)
  2.  Elbow inconsistency — changing elbow bend mid-rep
  3.  Arm asymmetry       — one arm leads the other
  4.  Shoulder shrug      — traps activating instead of chest
  5.  Trunk instability   — leaning/swinging for momentum
  6.  Incomplete stretch  — not opening wide enough at the bottom/start
  7.  Incomplete squeeze  — not contracting pecs fully at peak

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CABLE FLY GEOMETRY (FRONT VIEW)
  ─────────────────────────────────────────────────────────────
  PRIMARY SIGNAL: wrist_sep — normalized wrist separation
    wrist_sep = |n_lwr_x − n_rwr_x| / |n_lsh_x − n_rsh_x|
    Measured in shoulder-width units (1.0 = arms shoulder-width apart)

    s1  OPEN       : wrist_sep > 2.0   (arms fully stretched, at cables)
    s2  MOVING     : wrist_sep 0.6–2.0 (mid-range)
    s3  CONTRACTED : wrist_sep < 0.6   (pecs fully squeezed, peak contraction)

  Rep sequence: s1 → s2 → s3 → s2 → s1

  SECONDARY SIGNALS:
  ─────────────────
  fly_angle_L/R = joint_angle(hip, shoulder, wrist)
    Measures how far each arm has adducted from the body line.
    Same-side hip used as reference for the angle vertex base.
    Open: ~95–115°  |  Contracted: ~20–45°
    Difference between L and R = ASYMMETRY signal.

  elbow_avg = avg of joint_angle(shoulder, elbow, wrist) for both arms
    Good fly: 140–165° (soft bend, held CONSTANT throughout the rep)
    Over-bent (pressing): < 125°
    Inconsistency: deviation > 25° from the baseline captured at s1

  sh_rise = baseline_sh_y − current_sh_y  (normalized, +ve = shrug)
    Shoulder y is tracked per-frame. If shoulders rise significantly
    from the s1 baseline → shrug / trap activation detected.
    Threshold: > 4% frame height

  trunk_lean = vert_angle(shoulder_midpoint, hip_midpoint)
    A slight forward lean (10–20°) is correct for cable fly.
    INSTABILITY = trunk_lean deviates > 12° from s1 baseline
    (swinging the torso = using momentum, not chest).

  CABLE HEIGHT MODES:
  ─────────────────
  mid  : wrists at shoulder height throughout — standard fly
  high : wrists start above shoulder (cables overhead) — targets lower pec
  low  : wrists start below hip (cables low) — targets upper pec / clavicular head

  Each mode shifts the expected wrist_y zone and adjusts phase thresholds.
  ─────────────────────────────────────────────────────────────────────────
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
        # ── camera / session ─────────────────────────────────────────
        'camera_front'    : "Face the camera directly. Stand between the cable stacks.",
        'camera_side'     : "You are showing a side view. Please face the camera directly.",
        'reset'           : "Session reset. Whenever you are ready.",
        'get_ready'       : "Set your grip. Soft bend in the elbows. Slight lean forward. Brace your core.",
        # ── phase coaching ───────────────────────────────────────────
        'opening'         : "Open your arms wide. Feel the deep chest stretch.",
        'halfway_close'   : "Halfway. Keep squeezing. Drive your elbows together.",
        'contracted'      : "Hold the squeeze! Feel your pecs fully contracted.",
        'halfway_open'    : "Control the opening. Resist the weight on the way back.",
        'at_open'         : "Good stretch. Reset and squeeze again.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'        : "Good rep!",
        'no_stretch'      : "Not enough stretch. Open your arms wider next time.",
        'no_squeeze'      : "Incomplete contraction. Squeeze your chest harder at the top.",
        'bad_form_rep'    : "Form error — rep not counted. Reset and focus.",
        # ── form errors (voice only highest priority per frame) ──────
        'elbow_overbend'  : "Elbows too bent! You are pressing, not flying. Straighten them slightly.",
        'elbow_change'    : "Keep your elbow angle fixed throughout the rep. Do not extend your arms.",
        'asymmetry'       : "Arms are uneven! Both sides must move together at the same pace.",
        'shrug'           : "Shoulders creeping up! Depress your shoulder blades. Keep them down.",
        'trunk_swing'     : "You are swinging! Lock your trunk. Use your chest, not momentum.",
        'no_stretch_live' : "Open wider. Full stretch protects your shoulders and builds more chest.",
        'no_squeeze_live' : "Squeeze harder at the peak. Pause and feel the peak contraction.",
        # ── milestone counts ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start!",
        '5'  : "5 reps. Chest is working!",
        '10' : "10 reps. Excellent!",
        '15' : "15 reps. You are on fire!",
        '20' : "20 reps. Incredible effort!",
    }

    _COOLDOWN = {
        'camera_front'    : 7.0,
        'camera_side'     : 7.0,
        'reset'           : 5.0,
        'get_ready'       : 6.0,
        'opening'         : 2.5,
        'halfway_close'   : 2.5,
        'contracted'      : 2.0,
        'halfway_open'    : 2.5,
        'at_open'         : 2.0,
        'good_rep'        : 1.5,
        'no_stretch'      : 3.5,
        'no_squeeze'      : 3.5,
        'bad_form_rep'    : 3.5,
        'elbow_overbend'  : 4.5,
        'elbow_change'    : 4.5,
        'asymmetry'       : 4.0,
        'shrug'           : 4.0,
        'trunk_swing'     : 4.0,
        'no_stretch_live' : 5.0,
        'no_squeeze_live' : 5.0,
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
                # speed 1-10 → 120-230 wpm
                self._rate = int(120 + (speed - 1) * 12)
                threading.Thread(target=self._run, daemon=True).start()
                print(f"🎙  Voice coach active  (pyttsx3 · {self._rate} wpm)")
            else:
                print("⚠  pyttsx3 not installed — voice disabled.")
                print("   Run:  pip install pyttsx3")
                self.mute = True

    def say(self, key: str):
        """Speak with per-key cooldown. Latest cue wins."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        self._enqueue(self.PHRASES.get(key, key))

    def say_now(self, key: str):
        """Bypass cooldown — for rep milestones."""
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

def get_thresholds(mode: str = 'beginner', cable: str = 'mid') -> dict:
    """
    Primary thresholds.

    wrist_sep  = wrist spread in shoulder-width units  (>2 = open, <0.6 = contracted)
    fly_angle  = joint_angle(hip, sh, wrist) per arm   (~100° open, ~30° contracted)
    elbow_avg  = avg joint_angle(sh, el, wr) both arms (~150° — should stay fixed)
    sh_rise    = normalized shoulder y-rise from baseline (shrug)
    trunk_lean = vert_angle(sh_mid, hip_mid)

    cable heights shift the wrist_y expectations and open/contract thresholds:
      mid  : wrists roughly at shoulder height
      high : wrists start ABOVE shoulders → shorter wrist_sep at open
      low  : wrists start BELOW hips → higher wrist_sep possible
    """
    # Base threshold set
    if mode == 'pro':
        base = {
            'SEP_OPEN'        : 2.4,   # wrist_sep must exceed this to count as s1 (OPEN)
            'SEP_CONTRACTED'  : 0.40,  # wrist_sep must be below this for s3 (CONTRACTED)
            'ELBOW_MIN'       : 132,   # avg elbow angle below this = over-bend (pressing)
            'ELBOW_MAX'       : 168,   # above this = arms too straight (hyperextend risk)
            'ELBOW_DEV_MAX'   : 18,    # max deviation from baseline elbow during rep
            'ASYM_THRESH'     : 14,    # max |fly_angle_L − fly_angle_R| degrees
            'SHRUG_THRESH'    : 0.030, # normalized shoulder y-rise from baseline
            'TRUNK_DEV_MAX'   : 10,    # degrees trunk can deviate from baseline
            'STRETCH_MIN'     : 2.2,   # minimum wrist_sep to count as valid stretch
            'CONTRACT_MAX'    : 0.50,  # maximum wrist_sep to count as valid contraction
            'SIDE_VIS_THRESH' : 0.30,  # |V(l_sh) - V(r_sh)| > this → side view warning
            'INACTIVE_THRESH' : 15.0,
            'FB_FRAMES'       : 4,
        }
    else:   # beginner
        base = {
            'SEP_OPEN'        : 1.9,
            'SEP_CONTRACTED'  : 0.60,
            'ELBOW_MIN'       : 122,
            'ELBOW_MAX'       : 172,
            'ELBOW_DEV_MAX'   : 28,
            'ASYM_THRESH'     : 22,
            'SHRUG_THRESH'    : 0.045,
            'TRUNK_DEV_MAX'   : 16,
            'STRETCH_MIN'     : 1.7,
            'CONTRACT_MAX'    : 0.70,
            'SIDE_VIS_THRESH' : 0.35,
            'INACTIVE_THRESH' : 15.0,
            'FB_FRAMES'       : 5,
        }

    # Cable height adjustments
    # High cables: handles start above head → arms arc downward → wrist_sep lower at open
    # Low cables : handles start at floor → arms arc upward → wrist_sep higher at open
    if cable == 'high':
        base['SEP_OPEN']       = max(1.4, base['SEP_OPEN'] - 0.5)
        base['STRETCH_MIN']    = max(1.2, base['STRETCH_MIN'] - 0.5)
        base['CABLE_HEIGHT']   = 'high'
    elif cable == 'low':
        base['SEP_OPEN']       = base['SEP_OPEN'] + 0.2
        base['STRETCH_MIN']    = base['STRETCH_MIN'] + 0.2
        base['CABLE_HEIGHT']   = 'low'
    else:
        base['CABLE_HEIGHT']   = 'mid'

    base['MODE'] = mode
    return base


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3) -> int:
    """Angle at p2 between vectors p2→p1 and p2→p3. Returns 0–180°."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot) -> int:
    """Angle of segment p_top→p_bot from vertical. 0° = upright."""
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def midpoint_px(a, b):
    return np.array([(a[0]+b[0])//2, (a[1]+b[1])//2])


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
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def arc_angle(frame, center, vec1, vec2, angle_deg, color, radius=26):
    """Draw an angle arc between two vectors from center point."""
    sa = int(np.degrees(np.arctan2(vec1[1], vec1[0])))
    ea = int(np.degrees(np.arctan2(vec2[1], vec2[0])))
    cv2.ellipse(frame, tuple(center), (radius, radius), 0, sa, ea, color, 2, AA)
    mid = np.radians((sa + ea) / 2)
    tx  = int(center[0] + (radius + 18) * np.cos(mid))
    ty  = int(center[1] + (radius + 18) * np.sin(mid))
    cv2.putText(frame, f'{angle_deg}°', (tx, ty), FONT, 0.50, color, 2, AA)


def sep_bar(frame, fw, fh, wrist_sep, sep_open, sep_contract):
    """
    Horizontal progress bar showing wrist separation ratio.
    Left = contracted (0), Right = open (3+).
    Green zone = target open range. Red zone = too contracted.
    """
    bx, by, bw, bh = fw - 220, 45, 190, 12
    max_sep = sep_open * 1.3
    pct = min(max(wrist_sep / max_sep, 0.0), 1.0)

    # Track background
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (40, 40, 40), -1)

    # Zone markers
    open_x     = int(bx + (sep_open     / max_sep) * bw)
    contract_x = int(bx + (sep_contract / max_sep) * bw)

    # Green "open" zone marker
    cv2.rectangle(frame, (open_x, by), (bx+bw, by+bh), (0, 60, 20), -1)
    # Red "contracted" zone marker
    cv2.rectangle(frame, (bx, by), (contract_x, by+bh), (60, 10, 10), -1)

    # Filled progress
    fill = int(pct * bw)
    fill_col = (
        (0, 200, 80)  if wrist_sep >= sep_open    else
        (0, 200, 200) if wrist_sep >= sep_contract else
        (60, 80, 220)
    )
    if fill > 0:
        cv2.rectangle(frame, (bx, by), (bx+fill, by+bh), fill_col, -1)

    # Border
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (80, 80, 80), 1)

    # Label
    sep_txt = f'{wrist_sep:.2f}x'
    cv2.putText(frame, f'ARM SPREAD: {sep_txt}',
                (bx, by - 6), FONT, 0.38, C['gray'], 1, AA)
    cv2.putText(frame, 'OPEN',
                (open_x - 28, by + bh + 14), FONT, 0.32, (0, 180, 60), 1, AA)
    cv2.putText(frame, 'CLOSE',
                (bx, by + bh + 14), FONT, 0.32, (80, 80, 220), 1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS   idx → (label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('ELBOWS TOO BENT — FLY, DON\'T PRESS',   125, (30,  50, 210), 'elbow_overbend'),
    1: ('CHANGING ELBOW BEND — KEEP IT FIXED',   175, (30,  50, 210), 'elbow_change'),
    2: ('ARMS UNEVEN — MOVE BOTH TOGETHER',       225, (180,  30, 180), 'asymmetry'),
    3: ('SHRUGGING — KEEP SHOULDERS DOWN',        275, (180,  40,  40), 'shrug'),
    4: ('TRUNK SWINGING — LOCK YOUR CORE',        325, (180,  40,  40), 'trunk_swing'),
    5: ('OPEN WIDER — FULL CHEST STRETCH',        375, (20,  100,  30), 'no_stretch_live'),
    6: ('SQUEEZE MORE — PEAK CONTRACTION',        425, (0,   130, 130), 'no_squeeze_live'),
}

# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES
# ══════════════════════════════════════════════════════════════════════

LM = dict(
    nose=0,  l_ear=7,  r_ear=8,
    l_sh=11, r_sh=12,
    l_el=13, r_el=14,
    l_wr=15, r_wr=16,
    l_hip=23, r_hip=24,
    l_kn=25,  r_kn=26,
    l_ank=27, r_ank=28,
)


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class CableFlyProcessor:

    def __init__(self, T: dict, flip: bool = False, voice: VoiceCoach = None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        # Smoothing: elbow angle over 6-frame rolling buffer (reduces jitter)
        self._el_L_hist = collections.deque(maxlen=6)
        self._el_R_hist = collections.deque(maxlen=6)
        # Wrist sep smoothed over 4 frames (prevents state oscillation at boundaries)
        self._sep_hist  = collections.deque(maxlen=4)

        # Captured at s1 (start of rep) for deviation checks
        self._elbow_baseline: float | None = None
        self._trunk_baseline: float | None = None
        self._sh_y_baseline:  float | None = None

        # Best values seen in current rep for rep-level checks
        self._best_sep_open:     float = 0.0   # max sep seen at s1 (stretch)
        self._best_sep_contract: float = 9.9   # min sep seen at s3 (squeeze)

        # Side-view camera detection counter
        self._cam_side_cnt: int = 0

        self.S = dict(
            seq          = [],
            prev_state   = None,
            bad_form     = False,

            correct      = 0,
            incorrect    = 0,

            fb_cnt       = np.zeros(7, int),
            fb_show      = np.zeros(7, bool),

            last_phase   = None,
            halfway_said = False,

            inactive          = 0.0,
            last_t            = time.perf_counter(),
            last_state_inact  = None,
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

        n_lsh  = N('l_sh');  n_rsh  = N('r_sh')
        n_lel  = N('l_el');  n_rel  = N('r_el')
        n_lwr  = N('l_wr');  n_rwr  = N('r_wr')
        n_lhip = N('l_hip'); n_rhip = N('r_hip')

        # ── Camera check: warn if SIDE VIEW ─────────────────────────
        # For cable fly we NEED front view. Detect side-on position:
        # - large visibility difference between shoulders → side view
        # - very narrow shoulder span in pixels → side view
        vis_diff    = abs(V('l_sh') - V('r_sh'))
        sh_span_px  = abs(int(l_sh[0]) - int(r_sh[0]))
        is_side_view = (vis_diff > self.T['SIDE_VIS_THRESH']
                        and sh_span_px < fw * 0.12)

        self._cam_side_cnt = self._cam_side_cnt + 1 if is_side_view else 0
        if self._cam_side_cnt >= 20:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_side_view:
            self._cam_side_cnt = 0

        # ══════════════════════════════════════════════════════════════
        #  CORE MEASUREMENTS
        # ══════════════════════════════════════════════════════════════

        # 1. Wrist separation (PRIMARY state signal)
        #    shoulder_width_n: horizontal span of shoulders in normalised coords
        #    For a front-facing person: n_lsh_x > n_rsh_x (MediaPipe: person's
        #    left = image right = higher x). This is always positive for front view.
        sh_width_n = max(abs(n_lsh[0] - n_rsh[0]), 0.06)
        raw_sep    = abs(n_lwr[0] - n_rwr[0])
        self._sep_hist.append(raw_sep / sh_width_n)
        wrist_sep  = float(np.mean(self._sep_hist))

        # 2. Fly angles: how far each arm has adducted from the body line.
        #    joint_angle(same-side hip, shoulder, wrist).
        #    Both arms tracked independently for asymmetry detection.
        fly_angle_L = joint_angle(l_hip, l_sh, l_wr)
        fly_angle_R = joint_angle(r_hip, r_sh, r_wr)
        asymmetry   = abs(fly_angle_L - fly_angle_R)

        # 3. Elbow angles: should stay fixed throughout the rep.
        raw_el_L = joint_angle(l_sh, l_el, l_wr)
        raw_el_R = joint_angle(r_sh, r_el, r_wr)
        self._el_L_hist.append(raw_el_L)
        self._el_R_hist.append(raw_el_R)
        elbow_L   = int(np.mean(self._el_L_hist))
        elbow_R   = int(np.mean(self._el_R_hist))
        elbow_avg = (elbow_L + elbow_R) / 2

        # 4. Trunk lean — forward lean of the whole torso from vertical.
        sh_mid_px  = midpoint_px(l_sh,  r_sh)
        hip_mid_px = midpoint_px(l_hip, r_hip)
        trunk_lean = vert_angle(sh_mid_px, hip_mid_px)

        # 5. Shoulder rise — y-drop of shoulder midpoint (y increases downward).
        #    sh_rise > 0 means shoulders moved UP in frame (shrugging).
        sh_mid_y_n = (n_lsh[1] + n_rsh[1]) / 2.0   # normalised y

        # ── Determine state ──────────────────────────────────────────
        state = self._state(wrist_sep)

        # Capture baselines at the OPEN position (s1) before each rep
        if state == 's1' and not self.S['seq']:
            self._elbow_baseline = elbow_avg
            self._trunk_baseline = trunk_lean
            self._sh_y_baseline  = sh_mid_y_n
            self._best_sep_open  = max(self._best_sep_open, wrist_sep)

        # Track best contraction seen during s3
        if state == 's3':
            self._best_sep_contract = min(self._best_sep_contract, wrist_sep)

        # ══════════════════════════════════════════════════════════════
        #  FORM CHECKS  (7 simultaneous, debounced per FB_FRAMES)
        # ══════════════════════════════════════════════════════════════
        bad = np.zeros(7, bool)
        T   = self.T
        in_rep = state != 's1' or len(self.S['seq']) > 0

        if in_rep:

            # [0] Elbow over-bend: pressing instead of flying
            #     Both arms must be too bent to avoid single-arm false positives
            if elbow_L < T['ELBOW_MIN'] and elbow_R < T['ELBOW_MIN']:
                bad[0] = True

            # [1] Elbow inconsistency: changing bend mid-rep
            #     Only check if we have a baseline from this rep
            if (self._elbow_baseline is not None
                    and abs(elbow_avg - self._elbow_baseline) > T['ELBOW_DEV_MAX']):
                bad[1] = True

            # [2] Arm asymmetry: one side leads the other
            #     Only meaningful during movement (not at the extremes)
            if state == 's2' and asymmetry > T['ASYM_THRESH']:
                bad[2] = True

            # [3] Shoulder shrug: shoulder y-position rises from baseline
            if (self._sh_y_baseline is not None
                    and self._sh_y_baseline - sh_mid_y_n > T['SHRUG_THRESH']):
                bad[3] = True

            # [4] Trunk instability: torso angle deviates from s1 baseline
            if (self._trunk_baseline is not None
                    and abs(trunk_lean - self._trunk_baseline) > T['TRUNK_DEV_MAX']):
                bad[4] = True

            # [5] Incomplete stretch: at open phase, not wide enough
            #     Gate to s1 only — prevents false fires during contraction
            if state == 's1' and wrist_sep < T['STRETCH_MIN']:
                bad[5] = True

            # [6] Incomplete squeeze: at contracted phase, not close enough
            #     Gate to s3 only
            if state == 's3' and wrist_sep > T['CONTRACT_MAX']:
                bad[6] = True

        # Invalidate rep on movement-phase errors (not stretch/squeeze which
        # are rep-quality issues evaluated at completion)
        if any(bad[:5]):
            self.S['bad_form'] = True

        # Debounce: must persist for FB_FRAMES consecutive frames
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= T['FB_FRAMES']

        # Voice: highest-priority confirmed error only
        for i in range(7):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine & rep counting ─────────────────────────────
        self._update_seq(state)
        self._coach_phase(state, wrist_sep)

        if state == 's1' and self.S['prev_state'] != 's1':
            seq             = self.S['seq']
            full_rep        = 's3' in seq
            bad_stretch     = (self._best_sep_open < T['STRETCH_MIN'])
            bad_squeeze     = (self._best_sep_contract > T['CONTRACT_MAX'])

            if full_rep and not self.S['bad_form'] and not bad_squeeze:
                if bad_stretch:
                    # Rep technically complete but stretch was shallow
                    self.S['incorrect'] += 1
                    self.voice.say('no_stretch')
                    print(f"⚠   Rep — shallow stretch (sep {self._best_sep_open:.2f}×)")
                else:
                    self.S['correct'] += 1
                    n   = self.S['correct']
                    key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                    self.voice.say_now(key)
                    print(f"✅  Rep #{n} — correct")
            elif full_rep and bad_squeeze and not self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('no_squeeze')
                print(f"❌  Incomplete squeeze (best sep {self._best_sep_contract:.2f}×)")
            elif not full_rep and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.voice.say('no_squeeze')
                print(f"❌  Did not reach contracted position")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")

            # Reset for next rep
            self.S['seq']             = []
            self.S['bad_form']        = False
            self.S['halfway_said']    = False
            self._elbow_baseline      = None
            self._trunk_baseline      = None
            self._sh_y_baseline       = None
            self._best_sep_open       = 0.0
            self._best_sep_contract   = 9.9

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

        # ── Draw ─────────────────────────────────────────────────────
        self._draw_skeleton(frame, l_sh, r_sh, l_el, r_el, l_wr, r_wr,
                            l_hip, r_hip, l_kn, r_kn, l_ank, r_ank)
        self._draw_elbow_arcs(frame, l_sh, l_el, l_wr, elbow_L,
                              r_sh, r_el, r_wr, elbow_R)
        self._draw_fly_angles(frame, l_sh, l_wr, fly_angle_L,
                              r_sh, r_wr, fly_angle_R, asymmetry)
        self._draw_trunk_line(frame, sh_mid_px, hip_mid_px, trunk_lean)
        sep_bar(frame, fw, fh, wrist_sep,
                T['SEP_OPEN'], T['SEP_CONTRACTED'])
        self._draw_hud(frame, fw, state, wrist_sep)
        self._draw_feedback(frame)

        # Debug readout (bottom strip)
        cv2.putText(frame,
            f'SEP:{wrist_sep:.2f}x  EL_L:{elbow_L}  EL_R:{elbow_R}'
            f'  FLY_L:{fly_angle_L}  FLY_R:{fly_angle_R}'
            f'  ASYM:{asymmetry}  TRUNK:{trunk_lean}',
            (10, fh - 10), FONT, 0.28, C['gray'], 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, wrist_sep: float) -> str:
        """
        Three states based on wrist separation ratio:
          s1  OPEN        wrist_sep > SEP_OPEN
          s3  CONTRACTED  wrist_sep < SEP_CONTRACTED
          s2  MOVING      everything between
        No gap-clamping needed — s2 covers the full middle range.
        """
        if wrist_sep >= self.T['SEP_OPEN']:         return 's1'
        if wrist_sep <= self.T['SEP_CONTRACTED']:   return 's3'
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

    def _coach_phase(self, state: str, wrist_sep: float):
        if state != self.S['last_phase']:
            self.S['last_phase'] = state

            if state == 's1':
                if not self.S['seq']:
                    self.voice.say('get_ready')
                else:
                    self.voice.say('at_open')

            elif state == 's2':
                if 's3' not in self.S['seq']:
                    # Moving toward contraction
                    self.voice.say('opening')
                else:
                    # Returning from contraction to open
                    self.voice.say('halfway_open')

            elif state == 's3':
                self.voice.say('contracted')

        # Mid-rep "halfway" cue: around 50% of the separation range
        halfway_sep = (self.T['SEP_OPEN'] + self.T['SEP_CONTRACTED']) / 2
        if (state == 's2'
                and 's3' not in self.S['seq']
                and wrist_sep <= halfway_sep
                and not self.S['halfway_said']):
            self.S['halfway_said'] = True
            self.voice.say('halfway_close')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame,
                       l_sh, r_sh, l_el, r_el, l_wr, r_wr,
                       l_hip, r_hip, l_kn, r_kn, l_ank, r_ank):
        """Full body skeleton. Arms highlighted as primary movers."""
        lw = 3
        # Torso
        sh_mid  = midpoint_px(l_sh, r_sh)
        hip_mid = midpoint_px(l_hip, r_hip)
        cv2.line(frame, tuple(sh_mid), tuple(hip_mid), C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_sh), tuple(r_sh), C['lt_blue'], lw, AA)
        cv2.line(frame, tuple(l_hip), tuple(r_hip), C['lt_blue'], lw, AA)
        # Legs
        for a, b in [(l_hip, l_kn), (l_kn, l_ank),
                     (r_hip, r_kn), (r_kn, r_ank)]:
            cv2.line(frame, tuple(a), tuple(b), C['cyan'], lw, AA)
        # ── Arms (gold = primary movers) ─────────────────────────────
        for a, b in [(l_sh, l_el), (l_el, l_wr),
                     (r_sh, r_el), (r_el, r_wr)]:
            cv2.line(frame, tuple(a), tuple(b), C['gold'], lw+2, AA)
        # Joints
        for pt in (l_sh, r_sh, l_hip, r_hip):
            cv2.circle(frame, tuple(pt), 7, C['lt_blue'], -1, AA)
        for pt in (l_el, r_el, l_wr, r_wr):
            cv2.circle(frame, tuple(pt), 8, C['gold'], -1, AA)
            cv2.circle(frame, tuple(pt), 8, C['white'], 2, AA)
        for pt in (l_kn, r_kn, l_ank, r_ank):
            cv2.circle(frame, tuple(pt), 5, C['cyan'], -1, AA)

    def _draw_elbow_arcs(self, frame,
                         l_sh, l_el, l_wr, elbow_L,
                         r_sh, r_el, r_wr, elbow_R):
        """Elbow angle arcs on both arms, coloured by quality."""
        T = self.T
        for sh, el, wr, ang, label_side in [
            (l_sh, l_el, l_wr, elbow_L, 'L'),
            (r_sh, r_el, r_wr, elbow_R, 'R'),
        ]:
            col = (C['red']    if ang < T['ELBOW_MIN']
                   else C['orange'] if ang < T['ELBOW_MIN'] + 12
                   else C['green'])
            v1  = (sh - el).astype(float)
            v2  = (wr - el).astype(float)
            arc_angle(frame, el, v1, v2, ang, col, radius=22)

    def _draw_fly_angles(self, frame,
                         l_sh, l_wr, fly_L,
                         r_sh, r_wr, fly_R, asymmetry):
        """
        Draw the fly arc (arm sweep) for each side.
        Asymmetry displayed between the two labels.
        """
        asym_col = (C['red'] if asymmetry > self.T['ASYM_THRESH']
                    else C['orange'] if asymmetry > self.T['ASYM_THRESH'] * 0.6
                    else C['green'])

        for sh, wr, ang, side in [
            (l_sh, l_wr, fly_L, 'L'),
            (r_sh, r_wr, fly_R, 'R'),
        ]:
            # Line from shoulder to wrist with colour showing angle
            col = (C['green'] if ang < 50
                   else C['yellow'] if ang < 90
                   else C['orange'])
            cv2.line(frame, tuple(sh), tuple(wr), col, 2, AA)
            mid_pt = ((sh[0]+wr[0])//2, (sh[1]+wr[1])//2)
            cv2.putText(frame, f'{side}:{ang}°',
                        (mid_pt[0]+6, mid_pt[1]-6),
                        FONT, 0.44, col, 2, AA)

        # Asymmetry label between arms
        cx = (l_sh[0] + r_sh[0]) // 2
        cy = max(l_sh[1], r_sh[1]) + 28
        cv2.putText(frame, f'ASYM:{asymmetry}°',
                    (cx - 40, cy), FONT, 0.44, asym_col, 2, AA)

    def _draw_trunk_line(self, frame, sh_mid, hip_mid, trunk_lean):
        """Trunk line from shoulder midpoint to hip midpoint."""
        T   = self.T
        col = (C['red']    if abs(trunk_lean - (self._trunk_baseline or trunk_lean)) > T['TRUNK_DEV_MAX']
               else C['orange'] if abs(trunk_lean - (self._trunk_baseline or trunk_lean)) > T['TRUNK_DEV_MAX'] * 0.6
               else C['green'])
        cv2.line(frame, tuple(sh_mid), tuple(hip_mid), col, 3, AA)
        cv2.putText(frame, f'TRUNK:{trunk_lean}',
                    (sh_mid[0] + 10, sh_mid[1] + 20),
                    FONT, 0.42, col, 1, AA)

    def _draw_hud(self, frame, fw, state, wrist_sep):
        """Top-left HUD: phase, cable mode, counters."""
        phase_txt = {
            's1': 'OPEN  (STRETCH)',
            's2': 'MOVING',
            's3': 'CONTRACTED  (SQUEEZE)',
        }.get(state, '---')
        p_col = {
            's1': (0, 100, 40),
            's2': (0, 110, 170),
            's3': (0,  50, 190),
        }.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)

        cable_txt = self.T['CABLE_HEIGHT'].upper() + ' CABLE'
        mode_txt  = self.T['MODE'].upper()
        lbl(frame, f'{cable_txt} · {mode_txt}', 30, 62, scale=0.42, bg=(55, 55, 55))

        lbl(frame, f'CORRECT:   {self.S["correct"]}',   int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}', int(fw * 0.68), 84, bg=(180, 20, 20))

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 90, scale=0.46, bg=(180, 20, 20))

    def _draw_feedback(self, frame):
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.52, fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        """Fires when side-view camera detected. Cable fly needs front view."""
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 0)
        lbl(frame, 'CABLE FLY NEEDS FRONT VIEW — FACE THE CAMERA',
            30, fh - 55, scale=0.54, bg=(180, 80, 20), pad=10)
        self.voice.say('camera_side')
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
        self._draw_hud(frame, fw, None, 0)
        if self.flip:
            frame = cv2.flip(frame, 1)


# ══════════════════════════════════════════════════════════════════════
#  MEDIAPIPE
# ══════════════════════════════════════════════════════════════════════

def make_pose():
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,           # 2 = segfault on many Linux/macOS builds
        smooth_landmarks=True,
        min_detection_confidence=0.60,
        min_tracking_confidence=0.60,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='AI Cable Fly Analyzer')
    ap.add_argument('--video',  default=None,
                    help='Path to video file (omit for webcam)')
    ap.add_argument('--mode',   default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--cable',  default='mid',
                    choices=['high', 'mid', 'low'],
                    help='Cable attachment height (default: mid)')
    ap.add_argument('--flip',   action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',   action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',  type=int, default=5,
                    help='Speech speed 1–10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode, args.cable)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = CableFlyProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    cable_desc = {
        'high': 'HIGH CABLE  — cables above shoulder, targets lower pec',
        'mid' : 'MID CABLE   — cables at shoulder height, standard fly',
        'low' : 'LOW CABLE   — cables below hip, targets upper/clavicular pec',
    }[args.cable]

    print(f"\n🏋  Cable Fly Analyzer  [{args.mode.upper()}]")
    print(f"    Mode    : {cable_desc}")
    print(f"    Camera  : FRONT VIEW — face the camera directly")
    print(f"    Setup   : Stand between cables, slight forward lean, soft elbow bend")
    print("    Press   Q  to quit\n")
    print("  Form checks active:")
    print("    ✓ Elbow over-bend        (pressing instead of flying)")
    print("    ✓ Elbow inconsistency    (changing elbow bend mid-rep)")
    print("    ✓ Arm asymmetry          (one side leads the other)")
    print("    ✓ Shoulder shrug         (traps instead of chest)")
    print("    ✓ Trunk instability      (swinging for momentum)")
    print("    ✓ Incomplete stretch     (not opening wide enough)")
    print("    ✓ Incomplete squeeze     (not contracting fully at peak)\n")
    print(f"  Thresholds [{args.mode}]:")
    print(f"    Open when wrist_sep > {T['SEP_OPEN']:.1f}× shoulder width")
    print(f"    Contracted when wrist_sep < {T['SEP_CONTRACTED']:.1f}× shoulder width")
    print(f"    Elbow target: {T['ELBOW_MIN']}–{T['ELBOW_MAX']}° (fixed throughout rep)\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Cable Fly Analyzer — Q to quit', output)
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