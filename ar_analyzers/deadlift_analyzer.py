"""
AI Fitness Trainer - Deadlift Analyzer  (v1)
=============================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python deadlift_analyzer.py
    python deadlift_analyzer.py --mode pro
    python deadlift_analyzer.py --flip --mute
    python deadlift_analyzer.py --speed 7      # 1-10
    python deadlift_analyzer.py --style rdl    # Romanian DL (less depth required)

Camera: SIDE VIEW at hip/waist height. Full body visible in profile.

What it detects (7 simultaneous form checks):
  1.  Upper back rounding      — ear→shoulder→hip angle collapses
  2.  Lower back rounding      — spine deviation from ideal torso line
  3.  Bar drifting away        — wrist drifts forward from shin line
  4.  Hips shooting up         — hips rise before shoulders on the pull
  5.  Too much knee bend       — squatting the weight instead of hinging
  6.  Hyperextension lockout   — leaning back at the top
  7.  Incomplete lockout       — hips not fully extended at top

Voice coaches every phase:
  Setup → driving → at lockout → lowering → at bottom → all form errors

Deadlift geometry (SIDE VIEW):
  ─────────────────────────────────────────────────────────────────────
  The key movement is a HIP HINGE — torso tilts forward, hips go back.
  We track the hip_hinge_angle = vert_angle(shoulder → hip).

    s1  LOCKOUT : hip_hinge  0–22°   (standing, fully extended)
    s2  MOVING  : hip_hinge 23–58°   (mid-range, bar passing knees)
    s3  BOTTOM  : hip_hinge 59–100°  (bar at shin/floor, max hinge)

  Rep sequence: s1 → s2 → s3 → s2 → s1

  BACK ROUNDING uses TWO independent signals:
    a) neck_angle  = joint_angle(ear, shoulder, hip)
       Good: 150–180° (head neutral, spine flat)
       Upper back rounding: < 145°

    b) spine_dev = signed deviation of SHOULDER from EAR→HIP line
       Same math as plank hip_deviation — catches the torso curving
       Positive deviation = shoulder dropping below ideal line = rounding

  BAR DRIFT = normalized x-distance of wrist from ankle
       Bar should stay within 6% of frame width from ankle/shin
       If wrist drifts further away = bar leaving the body

  HIP SHOOT = detecting when hips rise faster than shoulders on the pull
       Track delta_hip_y vs delta_shoulder_y across frames
       If hips rise 50% more than shoulders = hips shooting up

  KNEE BEND = joint_angle(hip, knee, ankle)
       Good deadlift: 130–165° (slight bend)
       Squatting:      < 120° (too much knee, not enough hip hinge)
       Stiff-leg:      > 170° (fine for Romanian DL)

  LOCKOUT = at s1: hip_hinge < 12° AND shoulder-hip vertical
       Hyperextension: shoulder behind hip (person leaning back)
       Incomplete: hip_hinge 12–22° when returning to standing
  ─────────────────────────────────────────────────────────────────────
"""

import argparse
import subprocess
import sys
import time
import queue
import threading
import collections
import cv2
import mediapipe as mp
import numpy as np


# ══════════════════════════════════════════════════════════════════════
#  VOICE COACH
#  SpeakAsync — every new cue instantly cancels and replaces the last
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ───────────────────────────────────────────
        'camera'         : "Stand sideways to the camera.",
        'reset'          : "Counters reset.",
        'get_ready'      : "Set your position. Bar over mid foot.",
        # ── phase coaching ───────────────────────────────────────────
        'drive_up'       : "Drive your feet into the floor. Push away.",
        'through_knees'  : "Bar past the knees. Drive your hips through.",
        'lockout'        : "Lock it out. Squeeze your glutes. Stand tall.",
        'lower_slow'     : "Lower with control. Hinge your hips back.",
        'at_bottom'      : "Good depth. Brace up and pull.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'       : "Good rep!",
        'no_lockout'     : "No lockout. Fully extend your hips next time.",
        'bad_form_rep'   : "Rep not counted. Fix your form.",
        # ── form errors (fire immediately when detected) ─────────────
        'upper_round'    : "Upper back rounding! Chest up, shoulders back.",
        'lower_round'    : "Lower back rounding! Brace your core hard.",
        'bar_drift'      : "Bar drifting away from body. Keep it on the shin.",
        'hips_shoot'     : "Hips shooting up! Drive chest and hips together.",
        'knee_bend'      : "Too much knee bend. Hinge your hips more.",
        'hyperextend'    : "Don't lean back at lockout. Stand tall.",
        'incomplete_lock': "Extend your hips fully. Push them forward.",
        # ── milestone counts ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start!",
        '5'  : "5 reps. Keep going!",
        '10' : "10 reps. Amazing!",
        '15' : "15 reps. You are on fire!",
        '20' : "20 reps. Incredible!",
    }

    _COOLDOWN = {
        'camera'          : 7.0,
        'reset'           : 5.0,
        'get_ready'       : 6.0,
        'drive_up'        : 3.0,
        'through_knees'   : 3.0,
        'lockout'         : 2.5,
        'lower_slow'      : 3.0,
        'at_bottom'       : 2.5,
        'good_rep'        : 1.5,
        'no_lockout'      : 3.5,
        'bad_form_rep'    : 3.5,
        'upper_round'     : 4.0,
        'lower_round'     : 4.0,
        'bar_drift'       : 4.0,
        'hips_shoot'      : 4.0,
        'knee_bend'       : 4.5,
        'hyperextend'     : 4.0,
        'incomplete_lock' : 4.0,
    }

    _PS = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$s.Rate = {rate}; "
        "while ($true) {{ "
        "  $line = [Console]::In.ReadLine(); "
        "  if ($line -eq $null -or $line -eq 'EXIT') {{ break }}; "
        "  $s.SpeakAsyncCancelAll(); "
        "  $s.SpeakAsync($line) | Out-Null; "
        "}}"
    )

    def __init__(self, speed=5, mute=False):
        self.mute  = mute
        self._cd   = {}
        self._q    = queue.Queue()
        self._proc = None
        if not mute:
            self._launch(int((speed - 5) * 2))

    def say(self, key: str):
        """Speak with cooldown. Drops stale queue — latest wins."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        while not self._q.empty():
            try:    self._q.get_nowait()
            except queue.Empty: break
        self._q.put(self._phrase(key))

    def say_now(self, key: str):
        """Bypass cooldown — for rep counts and one-shots."""
        if self.mute:
            return
        self._q.put(self._phrase(key))

    def stop(self):
        if self._proc:
            try:
                self._proc.stdin.write('EXIT\n')
                self._proc.stdin.flush()
                self._proc.wait(timeout=2)
            except Exception:
                try:    self._proc.terminate()
                except Exception: pass

    def _phrase(self, key):
        return self.PHRASES.get(key, key)

    def _launch(self, rate):
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        try:
            self._proc = subprocess.Popen(
                ['powershell', '-NonInteractive', '-WindowStyle', 'Hidden',
                 '-Command', self._PS.format(rate=rate)],
                stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, creationflags=flags,
                text=True, encoding='utf-8', bufsize=1,
            )
            threading.Thread(target=self._writer, daemon=True).start()
        except FileNotFoundError:
            print("⚠  PowerShell not found — voice disabled.")
            self.mute = True

    def _writer(self):
        while True:
            try:
                p = self._q.get(timeout=0.5)
            except queue.Empty:
                if self._proc and self._proc.poll() is not None:
                    break
                continue
            if p == '__EXIT__':
                break
            try:
                self._proc.stdin.write(p + '\n')
                self._proc.stdin.flush()
            except (BrokenPipeError, OSError):
                break


# ══════════════════════════════════════════════════════════════════════
#  THRESHOLDS
# ══════════════════════════════════════════════════════════════════════

def get_thresholds(mode='beginner', style='conventional'):
    """
    All angle thresholds with full rationale.

    hip_hinge_angle = vert_angle(shoulder, hip) — how much torso is tilted
    neck_angle      = joint_angle(ear, shoulder, hip) — upper spine neutrality
    knee_angle      = joint_angle(hip, knee, ankle) — how bent the knees are
    spine_dev       = deviation of shoulder from ear→hip ideal line (normalized)
    bar_drift_norm  = normalized x-dist of wrist from ankle
    """
    if mode == 'pro':
        return {
            # ── states (hip hinge angle) ─────────────────────────────
            'STATES': {
                's1': (0,   18),    # lockout — hips fully extended
                's2': (19,  55),    # moving — bar between floor and hip
                's3': (56, 105),    # bottom — bar at shin/floor
            },
            # ── back rounding ────────────────────────────────────────
            'NECK_ANGLE_MIN'   : 155,   # below = upper back rounding
            'SPINE_DEV_MAX'    : 0.020, # shoulder deviates below ear→hip line
            # ── bar path ─────────────────────────────────────────────
            'BAR_DRIFT_MAX'    : 0.05,  # wrist more than 5% from ankle = drifting
            # ── knee ─────────────────────────────────────────────────
            'KNEE_BENT_MIN'    : 120,   # below = squatting (too much knee)
            'KNEE_STIFF_MAX'   : 172,   # above = stiff-leg (fine for RDL)
            # ── lockout quality ──────────────────────────────────────
            'LOCKOUT_HINGE_MAX': 12,    # hinge must be below this at lockout
            'HYPEREXT_THRESH'  : 8,     # shoulder behind hip by this much (norm %)
            # ── hip shoot detection ──────────────────────────────────
            'HIP_SHOOT_RATIO'  : 1.40,  # hips rising X× faster than shoulders
            # ── general ──────────────────────────────────────────────
            'OFFSET_THRESH'    : 35.0,
            'OFFSET_FRAMES'    : 15,
            'INACTIVE_THRESH'  : 15.0,
            'FB_FRAMES'        : 4,
            'STYLE'            : style,
        }
    else:  # beginner
        return {
            'STATES': {
                's1': (0,   22),
                's2': (23,  58),
                's3': (59, 105),
            },
            'NECK_ANGLE_MIN'   : 145,
            'SPINE_DEV_MAX'    : 0.030,
            'BAR_DRIFT_MAX'    : 0.07,
            'KNEE_BENT_MIN'    : 112,
            'KNEE_STIFF_MAX'   : 175,
            'LOCKOUT_HINGE_MAX': 18,
            'HYPEREXT_THRESH'  : 10,
            'HIP_SHOOT_RATIO'  : 1.55,
            'OFFSET_THRESH'    : 35.0,
            'OFFSET_FRAMES'    : 15,
            'INACTIVE_THRESH'  : 15.0,
            'FB_FRAMES'        : 5,
            'STYLE'            : style,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3):
    """Joint angle at p2 (degrees, 0–180)."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot):
    """
    Angle of segment p_top→p_bot from the vertical axis.
    0° = perfectly vertical, 90° = horizontal.
    Uses pixel coords — sign-independent (takes abs of dx).
    """
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def signed_deviation(p_a, p_mid, p_b):
    """
    Signed perpendicular deviation of p_mid from the p_a→p_b line.
    Uses NORMALIZED coords.
    Positive = p_mid is BELOW the line (in image y, which increases downward).
    Negative = p_mid is ABOVE the line.

    Used for:
      - Spine rounding: deviation of shoulder from ear→hip line
        If shoulder drops BELOW the ear→hip line → spine is curving = rounding
    """
    ax, ay = p_a[0],   p_a[1]
    bx, by = p_b[0],   p_b[1]
    mx, my = p_mid[0], p_mid[1]
    dx = bx - ax
    t  = (mx - ax) / dx if abs(dx) > 0.01 else 0.5
    ideal_y = ay + t * (by - ay)
    return my - ideal_y   # +ve = mid is below line


def camera_offset_angle(nose, l_sh, r_sh):
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
}


def rr(img, x1, y1, x2, y2, r, color):
    """Filled rounded rectangle."""
    cv2.rectangle(img, (x1+r,y1),   (x2-r,y1+r), color, -1)
    cv2.rectangle(img, (x1+r,y2-r), (x2-r,y2),   color, -1)
    cv2.rectangle(img, (x1,y1+r),   (x1+r,y2-r), color, -1)
    cv2.rectangle(img, (x2-r,y1+r), (x2,y2-r),   color, -1)
    cv2.rectangle(img, (x1+r,y1+r), (x2-r,y2-r), color, -1)
    for cx,cy,sa,ea in [(x1+r,y1+r,180,270),(x2-r,y1+r,270,360),
                        (x1+r,y2-r, 90,180),(x2-r,y2-r,  0, 90)]:
        cv2.ellipse(img,(cx,cy),(r,r),0,sa,ea,color,-1)


def lbl(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_v(img, pt, y0, y1, color, gap=8):
    for y in range(min(y0,y1), max(y0,y1), gap):
        cv2.circle(img, (int(pt[0]), y), 2, color, -1, AA)


def dotted_h(img, pt, x0, x1, color, gap=8):
    for x in range(min(x0,x1), max(x0,x1), gap):
        cv2.circle(img, (x, int(pt[1])), 2, color, -1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (on-screen label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('UPPER BACK ROUNDING — CHEST UP',       120, (180,  40,  40), 'upper_round'),
    1: ('LOWER BACK ROUNDING — BRACE CORE',     170, (180,  40,  40), 'lower_round'),
    2: ('BAR DRIFTING — KEEP ON YOUR SHIN',     220, (20,   60, 200), 'bar_drift'),
    3: ('HIPS SHOOTING UP — DRIVE TOGETHER',    270, (20,   60, 200), 'hips_shoot'),
    4: ('TOO MUCH KNEE BEND — HINGE MORE',      320, (150,  80,  20), 'knee_bend'),
    5: ('HYPEREXTENDING — STAND TALL',          370, (150,  80,  20), 'hyperextend'),
    6: ('LOCK OUT YOUR HIPS FULLY',             370, (20,  120,  20), 'incomplete_lock'),
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

class DeadliftProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        # Rolling history for hip-shoot detection (last 8 normalized y values)
        self._hip_hist = collections.deque(maxlen=8)
        self._sh_hist  = collections.deque(maxlen=8)

        self.S = dict(
            # ── rep state machine ─────────────────────────────────────
            seq           = [],
            prev_state    = None,
            bad_form      = False,

            # ── counters ──────────────────────────────────────────────
            correct       = 0,
            incorrect     = 0,

            # ── feedback debounce ─────────────────────────────────────
            fb_cnt        = np.zeros(7, int),
            fb_show       = np.zeros(7, bool),

            # ── voice phase ───────────────────────────────────────────
            last_phase    = None,
            bottom_said   = False,
            knees_said    = False,   # said "bar past knees" this rep

            # ── camera ────────────────────────────────────────────────
            cam_cnt       = 0,

            # ── inactivity ────────────────────────────────────────────
            inactive      = 0.0,
            last_t        = time.perf_counter(),
            last_state_inact = None,
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

        # ── All landmarks ───────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');   r_sh  = G('r_sh')
        l_el  = G('l_el');   r_el  = G('r_el')
        l_wr  = G('l_wr');   r_wr  = G('r_wr')
        l_hip = G('l_hip');  r_hip = G('r_hip')
        l_kn  = G('l_kn');   r_kn  = G('r_kn')
        l_ank = G('l_ank');  r_ank = G('r_ank')
        l_ft  = G('l_ft');   r_ft  = G('r_ft')
        l_ear = G('l_ear');  r_ear = G('r_ear')

        # Normalized (for camera-independent checks)
        nl_sh  = N('l_sh');  nr_sh  = N('r_sh')
        nl_wr  = N('l_wr');  nr_wr  = N('r_wr')
        nl_ank = N('l_ank'); nr_ank = N('r_ank')
        nl_hip = N('l_hip'); nr_hip = N('r_hip')
        nl_ear = N('l_ear'); nr_ear = N('r_ear')

        # ── Camera alignment ────────────────────────────────────────
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

        # ── Pick visible side (MediaPipe visibility) ─────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh,  el,  wr  = l_sh,  l_el,  l_wr
            hip, kn,  ank = l_hip, l_kn,  l_ank
            ft,  ear      = l_ft,  l_ear
            n_sh,  n_wr   = nl_sh, nl_wr
            n_ank, n_hip  = nl_ank, nl_hip
            n_ear         = nl_ear
        else:
            sh,  el,  wr  = r_sh,  r_el,  r_wr
            hip, kn,  ank = r_hip, r_kn,  r_ank
            ft,  ear      = r_ft,  r_ear
            n_sh,  n_wr   = nr_sh, nr_wr
            n_ank, n_hip  = nr_ank, nr_hip
            n_ear         = nr_ear

        # ══════════════════════════════════════════════════════════
        #  CORE MEASUREMENTS
        # ══════════════════════════════════════════════════════════

        # 1. Hip hinge = how far torso is tilted from vertical
        hip_hinge = vert_angle(sh, hip)

        # 2. Neck/upper-spine angle — spinal neutrality
        #    ear→shoulder→hip: smaller = upper back rounding
        neck_ang = joint_angle(ear, sh, hip)

        # 3. Spine curvature via signed deviation
        #    Shoulder deviation from EAR→HIP line (normalized)
        #    Positive = shoulder BELOW ideal line = spine curving = rounding
        spine_dev = signed_deviation(n_ear, n_sh, n_hip)

        # 4. Knee angle — deadlift = slight bend 130-165°
        knee_ang = joint_angle(hip, kn, ank)

        # 5. Bar drift — wrist distance from ankle in normalized x
        bar_drift = abs(n_wr[0] - n_ank[0])

        # 6. Hyperextension at lockout
        #    Shoulder should NOT be behind (upward-y in image = above) the hip
        #    In normalized x: if shoulder is behind hip by more than THRESH = leaning back
        #    In side-view: shoulder.x - hip.x (positive = shoulder behind = hyperextending)
        hyper_dev = n_sh[0] - n_hip[0]   # +ve = shoulder behind hip

        # ── Rolling history for hip-shoot detection ──────────────
        self._hip_hist.append(n_hip[1])   # y increases downward
        self._sh_hist.append(n_sh[1])

        # Detect: hips rising faster than shoulders on the pull
        hip_shoot = False
        if len(self._hip_hist) >= 6:
            delta_hip = self._hip_hist[0]  - self._hip_hist[-1]  # +ve = hip rising
            delta_sh  = self._sh_hist[0]   - self._sh_hist[-1]   # +ve = sh rising
            # Hip shooting: hips rise significantly more than shoulders
            if delta_hip > 0.005 and delta_sh > 0:
                ratio = delta_hip / (delta_sh + 1e-6)
                if ratio > self.T['HIP_SHOOT_RATIO']:
                    hip_shoot = True

        # ══════════════════════════════════════════════════════════
        #  FORM CHECKS
        # ══════════════════════════════════════════════════════════
        bad = np.zeros(7, bool)

        # Compute state here so it's available inside the in_motion checks below
        state = self._state(hip_hinge)

        # Only apply form checks when actually moving (not just standing still)
        in_motion = hip_hinge > 20 or len(self.S['seq']) > 0

        if in_motion:

            # [0] Upper back rounding — neck angle too small
            # Exempt at the bottom (s3): max-hinge geometry naturally compresses
            # the ear→shoulder→hip angle even with a neutral spine — checking here
            # produces false positives on correct form.
            if neck_ang < self.T['NECK_ANGLE_MIN'] and state != 's3':
                bad[0] = True

            # [1] Lower back / spine curve — shoulder drops below ear→hip line
            # Exempt at the bottom (s3) for the same reason: a small amount of
            # thoracic flex is biomechanically normal at full hinge depth.
            if spine_dev > self.T['SPINE_DEV_MAX'] and state != 's3':
                bad[1] = True

            # [2] Bar drifting away from body
            if bar_drift > self.T['BAR_DRIFT_MAX'] and hip_hinge > 30:
                bad[2] = True

            # [3] Hips shooting up (dynamic — tracked across frames)
            if hip_shoot and 's3' in self.S['seq']:
                bad[3] = True

            # [4] Too much knee bend (squatting instead of hinging)
            if knee_ang < self.T['KNEE_BENT_MIN'] and hip_hinge < 55:
                bad[4] = True

        # [5] Hyperextension at lockout
        if state == 's1' and len(self.S['seq']) > 0:
            # Check if leaning back at lockout
            if hyper_dev > self.T['HYPEREXT_THRESH'] / 100:
                bad[5] = True
            # Check incomplete lockout
            elif hip_hinge > self.T['LOCKOUT_HINGE_MAX']:
                bad[6] = True

        # Mark bad form for this rep
        # Errors 0-4 invalidate form; 5/6 are lockout-only warnings.
        # Note: 0 & 1 (back rounding) are already exempt at s3 above,
        # so they will only set bad_form when triggered during the moving phase.
        if any(bad[:5]):
            self.S['bad_form'] = True

        # Debounce per flag
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FB_FRAMES']

        # ── Voice — fire highest-priority confirmed error ─────────
        for i in range(7):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine ────────────────────────────────────────
        self._update_seq(state)

        # ── Voice phase coaching ─────────────────────────────────
        self._coach_phase(state, hip_hinge)

        # ── Rep counting ─────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            rdl = (self.T['STYLE'] == 'rdl')

            # For RDL: s2 is enough; for conventional: need s3
            depth_ok = ('s3' in seq) or (rdl and 's2' in seq and len(seq) >= 2)

            if depth_ok and not self.S['bad_form']:
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Rep #{n} — correct")
            elif not depth_ok and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.voice.say('no_lockout')
                print(f"❌  Incomplete — no full lockout")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")

            # Reset for next rep
            self.S['seq']        = []
            self.S['bad_form']   = False
            self.S['bottom_said'] = False
            self.S['knees_said'] = False

        self.S['prev_state'] = state

        # ── Inactivity reset ─────────────────────────────────────
        now = time.perf_counter()
        if state == self.S['last_state_inact']:
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']         = 0.0
            self.S['last_state_inact'] = state
        self.S['last_t'] = now

        # ── Draw ─────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip, kn, ank, ft, ear)
        self._draw_spine(frame, ear, sh, hip, neck_ang, spine_dev)
        self._draw_bar_path(frame, wr, ank, bar_drift)
        self._draw_knee_angle(frame, hip, kn, ank, knee_ang)
        self._draw_hud(frame, fw, state, hip_hinge)
        self._draw_feedback(frame)

        # Live debug readout (small, bottom of screen)
        cv2.putText(frame,
            f'HINGE:{hip_hinge}  NECK:{neck_ang}  '
            f'SPINE_DEV:{int(spine_dev*100)}%  KNEE:{knee_ang}  '
            f'BAR:{int(bar_drift*100)}%  HYPER:{int(hyper_dev*100)}%',
            (10, fh-12), FONT, 0.30, C['gray'], 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, hip_hinge):
        """
        Gap-free: if between states, clamp to nearest.
        Based on hip_hinge_angle = vert_angle(shoulder, hip).
        """
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= hip_hinge <= hi:
                return name
        # Clamp
        if hip_hinge < self.T['STATES']['s2'][0]:
            return 's1'
        if hip_hinge < self.T['STATES']['s3'][0]:
            return 's2'
        return 's3'

    def _update_seq(self, state):
        """Track s2→s3→s2 for rep counting. s1 triggers evaluation."""
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

    def _coach_phase(self, state, hip_hinge):
        """Fire coaching cues when entering each new phase."""
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Starting the pull (going down or just beginning to lift)
            if len(self.S['seq']) == 0:
                self.voice.say('get_ready')
            else:
                # On the way up — bar passing knees
                if not self.S['knees_said']:
                    self.S['knees_said'] = True
                    self.voice.say('through_knees')

        elif state == 's3':
            # Reached the bottom (max hinge)
            if not self.S['bottom_said']:
                self.S['bottom_said'] = True
                self.voice.say('at_bottom')

        elif state == 's2' and 's3' in self.S['seq']:
            # Pulling up from bottom — coach drive
            self.voice.say('drive_up')

        elif state == 's1' and self.S['prev_state'] == 's2':
            # Reached lockout
            self.voice.say('lockout')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip, kn, ank, ft, ear):
        """Full body skeleton — different colors for upper vs lower body."""
        # Upper body
        for a, b in [(ear,sh),(sh,el),(el,wr),(sh,hip)]:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 4, AA)
        # Lower body
        for a, b in [(hip,kn),(kn,ank),(ank,ft)]:
            cv2.line(frame, tuple(a), tuple(b), C['gold'], 4, AA)
        # Joints
        for pt in (ear, sh, el, wr):
            cv2.circle(frame, tuple(pt), 6, C['yellow'], -1, AA)
        for pt in (hip, kn, ank, ft):
            cv2.circle(frame, tuple(pt), 6, C['cyan'], -1, AA)

    def _draw_spine(self, frame, ear, sh, hip, neck_ang, spine_dev):
        """
        Draw the spine line with color-coded health.
        GREEN = neutral  |  RED = rounding  |  ORANGE = mild warning.

        Also draw the ideal straight line from ear to hip (dotted).
        """
        T = self.T

        # Upper back color (neck angle)
        upper_col = (C['red']    if neck_ang  < T['NECK_ANGLE_MIN']
                     else C['orange'] if neck_ang  < T['NECK_ANGLE_MIN'] + 10
                     else C['green'])

        # Lower back color (spine deviation)
        lower_col = (C['red']    if spine_dev > T['SPINE_DEV_MAX']
                     else C['orange'] if spine_dev > T['SPINE_DEV_MAX'] * 0.7
                     else C['green'])

        # Ideal straight spine line (ear→hip dotted)
        d    = int(np.linalg.norm(hip - ear))
        for i in range(0, d, 10):
            t  = i / max(d, 1)
            px_ = int(ear[0] + t*(hip[0]-ear[0]))
            py_ = int(ear[1] + t*(hip[1]-ear[1]))
            cv2.circle(frame, (px_, py_), 2, C['blue'], -1, AA)

        # Actual spine segments
        cv2.line(frame, tuple(ear), tuple(sh),  upper_col, 3, AA)
        cv2.line(frame, tuple(sh),  tuple(hip), lower_col, 3, AA)

        # Angle labels
        cv2.putText(frame, f'NECK:{neck_ang}°',
                    (sh[0]+10, sh[1]-8), FONT, 0.48, upper_col, 2, AA)
        dev_pct = int(spine_dev * 100)
        sign    = '+' if dev_pct >= 0 else ''
        cv2.putText(frame, f'BACK:{sign}{dev_pct}%',
                    (sh[0]+10, sh[1]+14), FONT, 0.42, lower_col, 1, AA)

    def _draw_bar_path(self, frame, wr, ank, bar_drift):
        """
        Show the bar (wrist) path relative to ankle (shin line).
        Vertical dotted line at ankle = ideal bar path.
        Color the wrist-to-ankle horizontal gap by severity.
        """
        T = self.T
        col = (C['red']    if bar_drift > T['BAR_DRIFT_MAX']
               else C['orange'] if bar_drift > T['BAR_DRIFT_MAX'] * 0.7
               else C['green'])

        # Shin line — ideal bar path
        dotted_v(frame, ank, ank[1]-120, ank[1], C['blue'])
        cv2.putText(frame, 'SHIN', (ank[0]+8, ank[1]-125),
                    FONT, 0.36, C['blue'], 1, AA)

        # Wrist marker
        cv2.circle(frame, tuple(wr), 9, col, -1, AA)
        cv2.circle(frame, tuple(wr), 9, C['white'], 2, AA)

        # Horizontal gap line
        if bar_drift > 0.01:
            cv2.line(frame, tuple(wr), (ank[0], wr[1]), col, 2, AA)
            drift_pct = int(bar_drift * 100)
            cv2.putText(frame, f'{drift_pct}%',
                        (min(wr[0], ank[0]) + 4, wr[1]-6),
                        FONT, 0.40, col, 1, AA)

    def _draw_knee_angle(self, frame, hip, kn, ank, knee_ang):
        """Knee angle arc and label."""
        T   = self.T
        col = (C['red']    if knee_ang < T['KNEE_BENT_MIN']
               else C['orange'] if knee_ang < T['KNEE_BENT_MIN'] + 15
               else C['green'])

        v1 = (hip - kn).astype(float)
        v2 = (ank - kn).astype(float)
        sa = int(np.degrees(np.arctan2(v1[1], v1[0])))
        ea = int(np.degrees(np.arctan2(v2[1], v2[0])))
        cv2.ellipse(frame, tuple(kn), (24,24), 0, sa, ea, col, 2, AA)
        cv2.putText(frame, f'{knee_ang}°',
                    (kn[0]+16, kn[1]+8), FONT, 0.50, col, 2, AA)

    def _draw_hud(self, frame, fw, state, hip_hinge):
        """Top-left HUD: phase, counters, hinge progress bar."""
        phase_txt = {
            's1': 'LOCKOUT',
            's2': 'MOVING',
            's3': 'AT BOTTOM',
        }.get(state, '---')
        p_col = {
            's1': (0, 130, 0),
            's2': (0, 110, 170),
            's3': (0,  50, 190),
        }.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)

        # Mode badge
        style_txt = self.T.get('STYLE','conv').upper()
        lbl(frame, style_txt, 30, 62, scale=0.42,
            bg=(60, 60, 60) if style_txt=='CONVENTIONAL' else (90,50,0))

        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw*0.68), 34, bg=(0,140,0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw*0.68), 84, bg=(180,20,20))

        # Hinge depth progress bar (0 = lockout, 100 = full hinge)
        s3_target = self.T['STATES']['s3'][0]   # start of s3 zone
        pct = min(max(hip_hinge / max(s3_target, 1), 0.0), 1.0)
        bx, by, bw, bh = 30, 78, 200, 9
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30,30,30), -1)
        fill = int(pct * bw)
        if fill > 0:
            col = (0,200,80) if pct < 1.0 else (0,255,180)
            cv2.rectangle(frame, (bx, by), (bx+fill, by+bh), col, -1)
        cv2.putText(frame, f'HINGE {hip_hinge}°',
                    (bx, by+bh+14), FONT, 0.38, C['gray'], 1, AA)

        # Bad form indicator this rep
        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP',
                30, 96, scale=0.48, bg=(180,20,20))

    def _draw_feedback(self, frame):
        """On-screen feedback labels — only for confirmed (debounced) flags."""
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.56,
                    fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']),
                        (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 0)
        lbl(frame, 'STAND SIDEWAYS TO CAMERA',
            30, fh-55, scale=0.58, bg=(180,80,20), pad=10)
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
        self._draw_hud(frame, fw, None, 0)
        if self.flip:
            frame = cv2.flip(frame, 1)


# ══════════════════════════════════════════════════════════════════════
#  MEDIAPIPE
# ══════════════════════════════════════════════════════════════════════

def make_pose():
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,           # 2 crashes (segfault) on many Linux/macOS builds
        smooth_landmarks=True,
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='AI Deadlift Analyzer')
    ap.add_argument('--video',  default=None,
                    help='Path to video file (omit for webcam)')
    ap.add_argument('--mode',   default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--style',  default='conventional',
                    choices=['conventional', 'rdl'],
                    help='conventional = bar from floor | rdl = Romanian (partial range)')
    ap.add_argument('--flip',   action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',   action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',  type=int, default=5,
                    help='Speech speed 1-10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode, args.style)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = DeadliftProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"🏋  Deadlift Analyzer  [{args.mode.upper()}]  [{args.style.upper()}]")
    print("    Camera  : SIDE VIEW at hip/waist height")
    print("    Setup   : Bar over mid-foot, feet hip-width apart")
    print("    Press   Q  to quit\n")

    print("  Form checks active:")
    print("    ✓ Upper back rounding   (neck/ear angle)")
    print("    ✓ Lower back rounding   (spine deviation)")
    print("    ✓ Bar drift             (wrist vs shin line)")
    print("    ✓ Hips shooting up      (dynamic tracking)")
    print("    ✓ Knee bend             (squatting vs hinging)")
    print("    ✓ Hyperextension        (lockout quality)")
    print("    ✓ Incomplete lockout    (hip extension)\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Deadlift Analyzer — Q to quit', output)
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