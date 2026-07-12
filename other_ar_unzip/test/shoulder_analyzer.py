"""
AI Fitness Trainer - Shoulder Press Analyzer  (v1)
==================================================
Install:  pip install opencv-python mediapipe numpy pyttsx3

Run:
    python shoulder_analyzer.py
    python shoulder_analyzer.py --mode pro
    python shoulder_analyzer.py --seated          # seated OHP (skips leg-drive check)
    python shoulder_analyzer.py --push-press      # allows knee dip
    python shoulder_analyzer.py --flip --mute
    python shoulder_analyzer.py --speed 7         # speech speed 1–10 (default 5)
    python shoulder_analyzer.py --video clip.mp4  # analyse a file instead of webcam

Camera: SIDE VIEW at shoulder height. Full body visible in profile.

What it detects (7 simultaneous form checks):
  1.  Lumbar hyperextension  — hips thrust forward + torso leans back
  2.  Excessive trunk lean   — leaning back too far throughout the press
  3.  Wrist drift            — wrists not stacked over shoulders at lockout
  4.  Forward head           — chin jutting forward as bar passes the face
  5.  Leg drive              — knee bend during a strict press
  6.  Incomplete lockout     — elbows not fully extended at top
  7.  Bar path deviation     — wrist drifting forward of shoulder during press

Overhead Press geometry (SIDE VIEW):
  ─────────────────────────────────────────────────────────────────
  Primary signal: elbow_angle = joint_angle(shoulder, elbow, wrist)

    s1  BOTTOM  : elbow_angle  55–100°   (bar at chin / front-rack)
    s2  PRESSING: elbow_angle 101–165°   (mid-range, bar moving up)
    s3  LOCKOUT : elbow_angle 166–185°   (arms fully extended overhead)

  Rep sequence: s1 → s2 → s3 → s2 → s1

  LUMBAR ARCH  uses two signals combined:
    a) trunk_angle = vert_angle(shoulder, hip)  — torso tilt from vertical
       Good press: 0–12°  |  Warning: > 15°  |  Bad: > 20°
    b) hip_forward = n_hip_x − n_ank_x  — hip drifting ahead of ankle
       If both exceed thresholds simultaneously → lumbar arch confirmed

  WRIST DRIFT = abs(n_wrist_x − n_shoulder_x)
    Only checked during s2 & s3 (some forward angle is normal at s1).
    Good: < 5 %  |  Warning: 5–8 %  |  Bad: > 8 %

  FORWARD HEAD = n_ear_x − n_shoulder_x  (positive = ear in front)
    Checked during s2 & s3 as bar passes the face.
    Good: < 5 %  |  Flag: > 7 %

  KNEE BEND = joint_angle(hip, knee, ankle)
    Strict OHP : > 163°  |  Push press: intentional dip (--push-press disables)

  BAR PATH tracks wrist_x deviation from its s1 baseline across the rep.
    If wrist drifts > 8 % forward from baseline during lockout → flagged.
  ─────────────────────────────────────────────────────────────────
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
#  VOICE COACH
#  pyttsx3-based — cross-platform (Windows / macOS / Linux)
#  Latest-wins queue: new cue always replaces pending one.
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / session ─────────────────────────────────────────
        'camera'          : "Stand sideways to the camera so I can see your full body.",
        'reset'           : "Session reset. Let's go again.",
        'get_ready'       : "Set your grip. Bar at shoulder height. Brace your core and take a big breath.",
        # ── phase coaching ───────────────────────────────────────────
        'drive_up'        : "Drive the bar straight up. Push your head through at the top.",
        'halfway'         : "Halfway there — keep pressing. Stay tight.",
        'lockout'         : "Lock it out. Squeeze. Elbows fully extended.",
        'lower_slow'      : "Lower with control. Guide the bar back to your shoulder.",
        'at_bottom'       : "Good. Reset your breath, brace, and press again.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'        : "Good rep!",
        'no_lockout'      : "Incomplete lockout. Fully extend your elbows next time.",
        'bad_form_rep'    : "Form error — rep not counted. Reset and go again.",
        # ── form errors ──────────────────────────────────────────────
        'lumbar_arch'     : "Hips forward! Squeeze your glutes and tuck your pelvis.",
        'trunk_lean'      : "You're leaning back too much. Keep your torso tall.",
        'wrist_drift'     : "Wrists drifting forward. Stack them directly over your elbows.",
        'forward_head'    : "Chin back! Keep your neck neutral as the bar passes your face.",
        'leg_drive'       : "You're bending your knees. Strict press — keep your legs locked.",
        'incomplete_lock' : "Extend fully at the top. Your elbows need to lock out.",
        'bar_path'        : "Bar is drifting forward. Press in a straight vertical line.",
        # ── milestone counts ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start!",
        '5'  : "5 reps. Looking strong!",
        '10' : "10 reps. Incredible work!",
        '15' : "15 reps. You are on fire!",
        '20' : "20 reps. Absolutely crushing it!",
    }

    _COOLDOWN = {
        'camera'          : 7.0,
        'reset'           : 5.0,
        'get_ready'       : 6.0,
        'drive_up'        : 2.5,
        'halfway'         : 2.5,
        'lockout'         : 2.0,
        'lower_slow'      : 2.5,
        'at_bottom'       : 2.0,
        'good_rep'        : 1.5,
        'no_lockout'      : 3.5,
        'bad_form_rep'    : 3.5,
        'lumbar_arch'     : 4.0,
        'trunk_lean'      : 4.0,
        'wrist_drift'     : 4.0,
        'forward_head'    : 4.0,
        'leg_drive'       : 4.5,
        'incomplete_lock' : 4.0,
        'bar_path'        : 4.0,
    }

    # Preferred voice names per platform (case-insensitive substring match)
    _VOICE_PREFS = ['zira', 'hazel', 'susan', 'samantha', 'victoria',
                    'female', 'en_us', 'en-us', 'english']

    def __init__(self, speed: int = 5, mute: bool = False):
        self.mute  = mute
        self._cd   = {}
        self._q    = queue.Queue(maxsize=2)
        self._stop = threading.Event()
        if not mute:
            if PYTTSX3_OK:
                # Map speed 1–10 → ~120–220 wpm
                self._rate = int(120 + (speed - 1) * 11)
                threading.Thread(target=self._run, daemon=True).start()
                print(f"🎙  Voice coach active  (pyttsx3 · {self._rate} wpm)")
            else:
                print("⚠  pyttsx3 not installed — voice disabled.")
                print("   Run:  pip install pyttsx3")
                self.mute = True

    # ── public API ───────────────────────────────────────────────────

    def say(self, key: str):
        """Speak a keyed phrase, respecting per-key cooldown."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        self._enqueue(self.PHRASES.get(key, key))

    def say_now(self, key: str):
        """Bypass cooldown — for rep-count milestones and one-shots."""
        if self.mute:
            return
        self._enqueue(self.PHRASES.get(key, key))

    def stop(self):
        self._stop.set()

    # ── internals ────────────────────────────────────────────────────

    def _enqueue(self, text: str):
        # Flush stale items so latest always wins
        while not self._q.empty():
            try:    self._q.get_nowait()
            except queue.Empty: break
        try:    self._q.put_nowait(text)
        except queue.Full: pass

    def _pick_voice(self, engine):
        """Select the best available voice."""
        voices = engine.getProperty('voices')
        if not voices:
            return
        for pref in self._VOICE_PREFS:
            for v in voices:
                name = (v.name or '').lower()
                langs = ' '.join(str(l) for l in (v.languages or [])).lower()
                if pref in name or pref in langs:
                    engine.setProperty('voice', v.id)
                    return
        # Fall back to first available
        engine.setProperty('voice', voices[0].id)

    def _run(self):
        """Background thread: speaks queued phrases one at a time."""
        try:
            engine = pyttsx3.init()
        except Exception as e:
            print(f"⚠  pyttsx3 init failed: {e}")
            return
        engine.setProperty('rate', self._rate)
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
                pass  # swallow driver errors silently


# ══════════════════════════════════════════════════════════════════════
#  THRESHOLDS
# ══════════════════════════════════════════════════════════════════════

def get_thresholds(mode: str = 'beginner',
                   seated: bool = False,
                   push_press: bool = False) -> dict:
    """
    All angle & distance thresholds.

    trunk_angle   = vert_angle(shoulder, hip)          — torso tilt from vertical
    hip_forward   = n_hip_x − n_ank_x                  — hip ahead of ankle (norm)
    elbow_angle   = joint_angle(shoulder, elbow, wrist) — press depth
    wrist_drift   = abs(n_wrist_x − n_shoulder_x)      — bar path deviation
    head_forward  = n_ear_x − n_shoulder_x              — forward head (norm)
    knee_angle    = joint_angle(hip, knee, ankle)       — leg bend
    """
    if mode == 'pro':
        T = {
            'STATES': {
                's1': (55,  100),   # bottom / rack
                's2': (101, 165),   # pressing
                's3': (166, 185),   # lockout
            },
            'TRUNK_LEAN_MAX'    : 15,    # degrees — torso back-tilt limit
            'HIP_FORWARD_MAX'   : 0.07,  # norm — hip ahead of ankle
            'WRIST_DRIFT_MAX'   : 0.05,  # norm — wrist ahead of shoulder
            'HEAD_FORWARD_MAX'  : 0.06,  # norm — ear ahead of shoulder
            'KNEE_ANGLE_MIN'    : 165,   # degrees — strict press leg lock
            'LOCKOUT_ANGLE_MIN' : 165,   # degrees — elbow extension at top
            'OFFSET_THRESH'     : 35.0,
            'OFFSET_FRAMES'     : 15,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 4,
        }
    else:   # beginner
        T = {
            'STATES': {
                's1': (55,  100),
                's2': (101, 165),
                's3': (166, 185),
            },
            'TRUNK_LEAN_MAX'    : 20,
            'HIP_FORWARD_MAX'   : 0.10,
            'WRIST_DRIFT_MAX'   : 0.07,
            'HEAD_FORWARD_MAX'  : 0.08,
            'KNEE_ANGLE_MIN'    : 160,
            'LOCKOUT_ANGLE_MIN' : 160,
            'OFFSET_THRESH'     : 35.0,
            'OFFSET_FRAMES'     : 15,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 5,
        }
    T['SEATED']     = seated
    T['PUSH_PRESS'] = push_press
    return T


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3) -> int:
    """Angle at p2, 0–180°."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot) -> int:
    """Angle of segment p_top→p_bot from vertical. 0° = upright."""
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def camera_offset_angle(nose, l_sh, r_sh) -> int:
    """Detect front-facing camera: angle at shoulder midpoint."""
    mid = ((l_sh + r_sh) / 2).astype(float)
    v1  = (l_sh - mid).astype(float)
    v2  = (nose  - mid).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def pxc(lm, idx, fw, fh):
    """Landmark → pixel coord (numpy int array)."""
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


def nmc(lm, idx):
    """Landmark → normalized [x, y, z]."""
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
    'purple'  : (200,   0, 180),
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


def lbl(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_v(img, pt, y0, y1, color, gap=8):
    for y in range(min(y0, y1), max(y0, y1), gap):
        cv2.circle(img, (int(pt[0]), y), 2, color, -1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS  idx → (label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('LUMBAR ARCH — TUCK YOUR PELVIS',         120, (180,  40,  40), 'lumbar_arch'),
    1: ('LEANING BACK TOO FAR — STAY TALL',       170, (180,  40,  40), 'trunk_lean'),
    2: ('WRISTS DRIFTING — STACK OVER ELBOWS',    220, (20,   60, 200), 'wrist_drift'),
    3: ('CHIN FORWARD — NEUTRAL NECK',            270, (20,   60, 200), 'forward_head'),
    4: ('BENDING KNEES — STRICT PRESS',           320, (150,  80,  20), 'leg_drive'),
    5: ('LOCK OUT YOUR ELBOWS FULLY',             370, (20,  120,  20), 'incomplete_lock'),
    6: ('BAR DRIFTING — PRESS STRAIGHT UP',       420, (130,  20, 130), 'bar_path'),
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
    l_ft=31,  r_ft=32,
)


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class ShoulderPressProcessor:

    def __init__(self, T: dict, flip: bool = False, voice: VoiceCoach = None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        # Smoothing buffer for elbow angle (reduces jitter)
        self._el_hist = collections.deque(maxlen=5)

        # Wrist x baseline captured at s1 (used for bar-path drift check)
        self._wrist_x_base: float | None = None

        self.S = dict(
            # ── rep state machine ──────────────────────────────────
            seq           = [],
            prev_state    = None,
            bad_form      = False,

            # ── counters ──────────────────────────────────────────
            correct       = 0,
            incorrect     = 0,

            # ── feedback debounce ─────────────────────────────────
            fb_cnt        = np.zeros(7, int),
            fb_show       = np.zeros(7, bool),

            # ── voice phase ───────────────────────────────────────
            last_phase    = None,
            halfway_said  = False,

            # ── camera ────────────────────────────────────────────
            cam_cnt       = 0,

            # ── inactivity ────────────────────────────────────────
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

        # ── All landmarks ────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');  r_sh  = G('r_sh')
        l_el  = G('l_el');  r_el  = G('r_el')
        l_wr  = G('l_wr');  r_wr  = G('r_wr')
        l_hip = G('l_hip'); r_hip = G('r_hip')
        l_kn  = G('l_kn');  r_kn  = G('r_kn')
        l_ank = G('l_ank'); r_ank = G('r_ank')
        l_ft  = G('l_ft');  r_ft  = G('r_ft')
        l_ear = G('l_ear'); r_ear = G('r_ear')

        nl_sh  = N('l_sh');  nr_sh  = N('r_sh')
        nl_wr  = N('l_wr');  nr_wr  = N('r_wr')
        nl_hip = N('l_hip'); nr_hip = N('r_hip')
        nl_ank = N('l_ank'); nr_ank = N('r_ank')
        nl_ear = N('l_ear'); nr_ear = N('r_ear')

        # ── Camera alignment ─────────────────────────────────────
        off_ang  = camera_offset_angle(nose, l_sh, r_sh)
        sp_px    = abs(int(l_sh[0]) - int(r_sh[0]))
        vis_diff = abs(V('l_sh') - V('r_sh'))
        is_front = (off_ang > self.T['OFFSET_THRESH']
                    and sp_px > fw * 0.18
                    and vis_diff < 0.25)
        self.S['cam_cnt'] = self.S['cam_cnt'] + 1 if is_front else 0
        if self.S['cam_cnt'] >= self.T['OFFSET_FRAMES']:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_front:
            self.S['cam_cnt'] = 0

        # ── Pick most-visible side ────────────────────────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh,  el,  wr  = l_sh,  l_el,  l_wr
            hip, kn,  ank = l_hip, l_kn,  l_ank
            ft,  ear      = l_ft,  l_ear
            n_sh,  n_wr   = nl_sh, nl_wr
            n_hip, n_ank  = nl_hip, nl_ank
            n_ear         = nl_ear
        else:
            sh,  el,  wr  = r_sh,  r_el,  r_wr
            hip, kn,  ank = r_hip, r_kn,  r_ank
            ft,  ear      = r_ft,  r_ear
            n_sh,  n_wr   = nr_sh, nr_wr
            n_hip, n_ank  = nr_hip, nr_ank
            n_ear         = nr_ear

        # ══════════════════════════════════════════════════════════
        #  CORE MEASUREMENTS
        # ══════════════════════════════════════════════════════════

        # 1. Elbow angle → press depth (smoothed over last 5 frames)
        raw_el   = joint_angle(sh, el, wr)
        self._el_hist.append(raw_el)
        elbow_ang = int(np.mean(self._el_hist))

        # 2. Trunk angle — how far torso is leaning back from vertical
        trunk_ang = vert_angle(sh, hip)

        # 3. Hip forward — hip x ahead of ankle x (lumbar arch indicator)
        hip_forward = float(n_hip[0] - n_ank[0])   # +ve = hip in front

        # 4. Wrist drift — wrist x vs shoulder x (bar path)
        wrist_drift = float(n_wr[0] - n_sh[0])     # +ve = wrist in front

        # 5. Forward head — ear x vs shoulder x
        head_forward = float(n_ear[0] - n_sh[0])   # +ve = ear in front

        # 6. Knee angle
        knee_ang = joint_angle(hip, kn, ank)

        # ── Determine state ───────────────────────────────────────
        state = self._state(elbow_ang)

        # Capture wrist x baseline when at the bottom (s1) before the rep
        if state == 's1' and not self.S['seq']:
            self._wrist_x_base = float(n_wr[0])

        # ══════════════════════════════════════════════════════════
        #  FORM CHECKS
        # ══════════════════════════════════════════════════════════
        bad = np.zeros(7, bool)
        T   = self.T

        in_motion = elbow_ang > 105 or len(self.S['seq']) > 0

        if in_motion:

            # [0] Lumbar arch — hip thrust AND trunk lean together
            if (trunk_ang   > T['TRUNK_LEAN_MAX']
                    and hip_forward > T['HIP_FORWARD_MAX']):
                bad[0] = True

            # [1] Excessive trunk lean — severe lean even without hip thrust
            if trunk_ang > T['TRUNK_LEAN_MAX'] * 1.6:
                bad[1] = True

            # [2] Wrist drift — only during pressing & lockout
            if state in ('s2', 's3') and abs(wrist_drift) > T['WRIST_DRIFT_MAX']:
                bad[2] = True

            # [3] Forward head — as bar passes the face
            if state in ('s2', 's3') and head_forward > T['HEAD_FORWARD_MAX']:
                bad[3] = True

            # [4] Leg drive — skip if seated or push-press mode
            if (not T['SEATED'] and not T['PUSH_PRESS']
                    and state in ('s1', 's2')
                    and knee_ang < T['KNEE_ANGLE_MIN']):
                bad[4] = True

        # [5] Incomplete lockout — checked at top only
        if state == 's3' and len(self.S['seq']) > 0:
            if elbow_ang < T['LOCKOUT_ANGLE_MIN']:
                bad[5] = True

        # [6] Bar path drift — wrist x compared to s1 baseline
        if (state in ('s2', 's3')
                and self._wrist_x_base is not None
                and abs(float(n_wr[0]) - self._wrist_x_base) > 0.08):
            bad[6] = True

        # Flag rep bad if any movement-phase errors (0-4)
        if any(bad[:5]):
            self.S['bad_form'] = True

        # Debounce: require FB_FRAMES consecutive frames before showing
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= T['FB_FRAMES']

        # Voice — highest-priority confirmed error only
        for i in range(7):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine & rep counting ─────────────────────────
        self._update_seq(state)
        self._coach_phase(state, elbow_ang)

        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            full_rep = 's3' in seq

            if full_rep and not self.S['bad_form']:
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Rep #{n} — correct")
            elif not full_rep and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.voice.say('no_lockout')
                print(f"❌  Incomplete — no lockout")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")

            # Reset for next rep
            self.S['seq']        = []
            self.S['bad_form']   = False
            self.S['halfway_said'] = False
            self._wrist_x_base   = None

        self.S['prev_state'] = state

        # ── Inactivity reset ─────────────────────────────────────
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

        # ── Draw ─────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip, kn, ank, ft, ear)
        self._draw_elbow_arc(frame, sh, el, wr, elbow_ang)
        self._draw_trunk_line(frame, sh, hip, trunk_ang)
        self._draw_wrist_guide(frame, sh, wr, wrist_drift)
        self._draw_hud(frame, fw, state, elbow_ang)
        self._draw_feedback(frame)

        # Debug readout
        mode_tag = ('SEATED' if T['SEATED'] else
                    'PUSH-PRESS' if T['PUSH_PRESS'] else 'STRICT')
        cv2.putText(frame,
            f'EL:{elbow_ang}  TRUNK:{trunk_ang}  '
            f'HIP_FWD:{int(hip_forward*100)}%  '
            f'WR:{int(wrist_drift*100)}%  '
            f'HEAD:{int(head_forward*100)}%  '
            f'KNEE:{knee_ang}  [{mode_tag}]',
            (10, fh - 12), FONT, 0.28, C['gray'], 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, elbow_ang: int) -> str:
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= elbow_ang <= hi:
                return name
        if elbow_ang < self.T['STATES']['s2'][0]:
            return 's1'
        if elbow_ang < self.T['STATES']['s3'][0]:
            return 's2'
        return 's3'

    def _update_seq(self, state: str):
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

    def _coach_phase(self, state: str, elbow_ang: int):
        if state != self.S['last_phase']:
            self.S['last_phase'] = state

            if state == 's1':
                if len(self.S['seq']) == 0:
                    self.voice.say('get_ready')
                else:
                    self.voice.say('at_bottom')

            elif state == 's2':
                if 's3' not in self.S['seq']:
                    self.voice.say('drive_up')
                else:
                    self.voice.say('lower_slow')

            elif state == 's3':
                self.voice.say('lockout')

        # Mid-rep "halfway" cue when elbow crosses 130° on the way up
        if (state == 's2'
                and 's3' not in self.S['seq']
                and elbow_ang >= 130
                and not self.S['halfway_said']):
            self.S['halfway_said'] = True
            self.voice.say('halfway')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip, kn, ank, ft, ear):
        """Body skeleton with press-specific highlight."""
        # Upper body (press chain highlighted)
        for a, b in [(ear, sh), (sh, hip)]:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 3, AA)
        # Press arm in gold
        for a, b in [(sh, el), (el, wr)]:
            cv2.line(frame, tuple(a), tuple(b), C['gold'], 5, AA)
        # Lower body
        for a, b in [(hip, kn), (kn, ank), (ank, ft)]:
            cv2.line(frame, tuple(a), tuple(b), C['cyan'], 3, AA)
        # Joints
        for pt, col in [(ear, C['yellow']), (sh, C['yellow']),
                        (el, C['white']),   (wr, C['white'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1, AA)
        for pt in (hip, kn, ank, ft):
            cv2.circle(frame, tuple(pt), 6, C['cyan'], -1, AA)

    def _draw_elbow_arc(self, frame, sh, el, wr, elbow_ang: int):
        """Arc at elbow joint with angle label."""
        T   = self.T
        col = (C['red']    if elbow_ang < T['LOCKOUT_ANGLE_MIN'] and 's3' in self.S['seq']
               else C['orange'] if elbow_ang < T['LOCKOUT_ANGLE_MIN'] + 10
               else C['green'])
        v1 = (sh - el).astype(float)
        v2 = (wr - el).astype(float)
        sa = int(np.degrees(np.arctan2(v1[1], v1[0])))
        ea = int(np.degrees(np.arctan2(v2[1], v2[0])))
        cv2.ellipse(frame, tuple(el), (28, 28), 0, sa, ea, col, 2, AA)
        cv2.putText(frame, f'{elbow_ang}°',
                    (el[0] + 18, el[1] + 8), FONT, 0.52, col, 2, AA)

    def _draw_trunk_line(self, frame, sh, hip, trunk_ang: int):
        """Vertical guide line + trunk tilt angle."""
        T   = self.T
        col = (C['red']    if trunk_ang > T['TRUNK_LEAN_MAX'] * 1.6
               else C['orange'] if trunk_ang > T['TRUNK_LEAN_MAX']
               else C['green'])
        # Ideal vertical from shoulder
        dotted_v(frame, sh, sh[1] - 60, sh[1] + 60, C['blue'])
        # Actual torso line
        cv2.line(frame, tuple(sh), tuple(hip), col, 3, AA)
        cv2.putText(frame, f'TRUNK:{trunk_ang}°',
                    (sh[0] + 10, sh[1] + 20), FONT, 0.44, col, 1, AA)

    def _draw_wrist_guide(self, frame, sh, wr, wrist_drift: float):
        """Vertical ideal line from shoulder; wrist marker."""
        T    = self.T
        col  = (C['red']    if abs(wrist_drift) > T['WRIST_DRIFT_MAX']
                else C['orange'] if abs(wrist_drift) > T['WRIST_DRIFT_MAX'] * 0.6
                else C['green'])
        # Ideal vertical path from shoulder
        dotted_v(frame, sh, sh[1] - 200, sh[1], C['blue'])
        cv2.putText(frame, 'IDEAL', (sh[0] + 5, sh[1] - 205),
                    FONT, 0.32, C['blue'], 1, AA)
        # Wrist marker
        cv2.circle(frame, tuple(wr), 10, col, -1, AA)
        cv2.circle(frame, tuple(wr), 10, C['white'], 2, AA)
        # Drift percentage
        drift_pct = int(wrist_drift * 100)
        sign = '+' if drift_pct >= 0 else ''
        cv2.putText(frame, f'WR:{sign}{drift_pct}%',
                    (wr[0] + 12, wr[1]), FONT, 0.40, col, 1, AA)

    def _draw_hud(self, frame, fw, state, elbow_ang: int):
        """Top-left HUD: phase, counters, elbow progress bar."""
        phase_txt = {'s1': 'BOTTOM', 's2': 'PRESSING', 's3': 'LOCKOUT'}.get(state, '---')
        p_col     = {'s1': (0, 80, 180), 's2': (0, 120, 0), 's3': (0, 180, 60)}.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)

        mode_str = ('SEATED' if self.T['SEATED'] else
                    'PUSH-PRESS' if self.T['PUSH_PRESS'] else 'STRICT OHP')
        lbl(frame, mode_str, 30, 62, scale=0.42, bg=(60, 60, 60))

        lbl(frame, f'CORRECT:   {self.S["correct"]}',   int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}', int(fw * 0.68), 84, bg=(180, 20, 20))

        # Elbow extension progress bar (55° → LOCKOUT_ANGLE_MIN)
        lo = self.T['STATES']['s1'][1]      # 100°
        hi = self.T['LOCKOUT_ANGLE_MIN']    # 160–165°
        pct = min(max((elbow_ang - lo) / max(hi - lo, 1), 0.0), 1.0)
        bx, by, bw, bh = 30, 78, 200, 9
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30, 30, 30), -1)
        fill = int(pct * bw)
        if fill > 0:
            col = (0, 200, 80) if pct < 1.0 else (0, 255, 180)
            cv2.rectangle(frame, (bx, by), (bx+fill, by+bh), col, -1)
        cv2.putText(frame, f'ELBOW {elbow_ang}°',
                    (bx, by+bh+14), FONT, 0.38, C['gray'], 1, AA)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 96, scale=0.48, bg=(180, 20, 20))

    def _draw_feedback(self, frame):
        """On-screen feedback — debounced flags only."""
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.54, fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose, C['white']), (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 90)
        lbl(frame, 'STAND SIDEWAYS TO CAMERA',
            30, fh - 55, scale=0.58, bg=(180, 80, 20), pad=10)
        self.voice.say('camera')
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
        self._draw_hud(frame, fw, None, 90)
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
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='AI Shoulder Press Analyzer')
    ap.add_argument('--video',       default=None,
                    help='Path to video file (omit for webcam)')
    ap.add_argument('--mode',        default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--seated',      action='store_true',
                    help='Seated OHP — disables leg-drive check')
    ap.add_argument('--push-press',  action='store_true',
                    help='Allow knee dip (push press style)')
    ap.add_argument('--flip',        action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',        action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',       type=int, default=5,
                    help='Speech speed 1-10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode, args.seated, args.push_press)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = ShoulderPressProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    style = ('SEATED' if args.seated else
             'PUSH-PRESS' if args.push_press else 'STRICT')

    print(f"\n🏋  Shoulder Press Analyzer  [{args.mode.upper()}]  [{style}]")
    print("    Camera : SIDE VIEW at shoulder height")
    print("    Setup  : Bar in front rack, feet shoulder-width, core braced")
    print("    Press  Q  to quit\n")
    print("  Form checks active:")
    print("    ✓ Lumbar hyperextension  (hip thrust + trunk lean)")
    print("    ✓ Excessive trunk lean   (torso angle)")
    print("    ✓ Wrist drift            (bar path vs shoulder)")
    print("    ✓ Forward head           (ear vs shoulder position)")
    if not args.seated and not args.push_press:
        print("    ✓ Leg drive              (knee angle during strict press)")
    else:
        print("    — Leg drive              (disabled — push-press / seated mode)")
    print("    ✓ Incomplete lockout     (elbow extension at top)")
    print("    ✓ Bar path deviation     (wrist x vs baseline)\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Shoulder Press Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        print(f"\n── Session Results ──────────────────────")
        print(f"  ✅  Correct   : {proc.S['correct']}")
        print(f"  ❌  Incorrect : {proc.S['incorrect']}")


if __name__ == '__main__':
    main()