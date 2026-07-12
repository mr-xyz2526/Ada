"""
AI Fitness Trainer - Lunge Analyzer  (v1)
==========================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python lunge_analyzer.py
    python lunge_analyzer.py --mode pro
    python lunge_analyzer.py --flip --mute
    python lunge_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at hip/waist height. Full body visible in profile.

What it tracks:
  • Rep counting  (correct vs incorrect)
  • Front knee caving over toe
  • Torso leaning too far forward
  • Torso leaning too far backward
  • Not reaching proper depth (back knee not near floor)
  • Squat too deep (over-bending front knee)
  • Back knee not bending enough

Voice coaches every phase:
  Step forward → going down → at depth → driving up → rep complete → all form errors

How a lunge works (geometry):
  In SIDE VIEW:
    - Front leg steps forward  → front knee bends to ~90°
    - Back leg stays behind    → back knee bends and drops toward floor
    - Torso stays upright      → shoulder-hip segment mostly vertical
    - Front knee must NOT pass over front toe
    - Both knees should reach ~90° at full depth

  We detect FRONT vs BACK leg by comparing which leg has the more
  bent knee AND which foot is further forward in the frame.
"""

import argparse
import subprocess
import sys
import time
import queue
import threading
import cv2
import mediapipe as mp
import numpy as np


# ══════════════════════════════════════════════════════════════════════
#  VOICE COACH
#  Single persistent PowerShell — SpeakAsync for instant interruption
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ───────────────────────────────────────────
        'camera'          : "Stand sideways to the camera.",
        'reset'           : "Counters reset.",
        'stand_straight'  : "Stand straight. Get ready.",
        # ── phase coaching ───────────────────────────────────────────
        'step_forward'    : "Step forward and lower down.",
        'going_down'      : "Lower your back knee toward the floor.",
        'at_depth'        : "Good depth. Now drive back up.",
        'coming_up'       : "Drive through your front heel.",
        'at_top'          : "Stand tall. Reset your stance.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'        : "Good lunge!",
        'too_shallow'     : "Too shallow. Lower your back knee next time.",
        'bad_form_rep'    : "Rep not counted. Fix your form.",
        # ── form errors ──────────────────────────────────────────────
        'knee_over_toe'   : "Knee over toe! Push your knee back.",
        'lean_forward'    : "Leaning forward. Keep your chest up.",
        'lean_back'       : "Leaning back. Engage your core.",
        'too_deep'        : "Too deep. Control your front knee.",
        'back_knee_high'  : "Lower your back knee toward the floor.",
        'front_knee_in'   : "Front knee caving in. Push it outward.",
        # ── rep count milestones ─────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start!",
        '5'  : "5 reps. Keep going!",
        '10' : "10 reps. Amazing!",
        '15' : "15 reps. You are on fire!",
        '20' : "20 reps. Incredible!",
    }

    _COOLDOWN = {
        'camera'         : 7.0,
        'reset'          : 5.0,
        'stand_straight' : 5.0,
        'step_forward'   : 3.0,
        'going_down'     : 2.5,
        'at_depth'       : 2.0,
        'coming_up'      : 2.0,
        'at_top'         : 2.5,
        'good_rep'       : 1.5,
        'too_shallow'    : 3.0,
        'bad_form_rep'   : 3.0,
        'knee_over_toe'  : 4.0,
        'lean_forward'   : 4.0,
        'lean_back'      : 4.0,
        'too_deep'       : 4.0,
        'back_knee_high' : 4.0,
        'front_knee_in'  : 4.0,
    }

    # SpeakAsync + CancelAll = every new cue instantly interrupts the last
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
        """Speak with cooldown. Always replaces stale queued phrases."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        while not self._q.empty():
            try: self._q.get_nowait()
            except queue.Empty: break
        self._q.put(self._get(key))

    def say_now(self, key: str):
        """Speak immediately, bypass cooldown (rep counts, one-shots)."""
        if self.mute:
            return
        self._q.put(self._get(key))

    def stop(self):
        if self._proc:
            try:
                self._proc.stdin.write('EXIT\n')
                self._proc.stdin.flush()
                self._proc.wait(timeout=2)
            except Exception:
                try: self._proc.terminate()
                except Exception: pass

    def _get(self, key):
        return self.PHRASES.get(key, key)

    def _launch(self, rate):
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        try:
            self._proc = subprocess.Popen(
                ['powershell', '-NonInteractive', '-WindowStyle', 'Hidden',
                 '-Command', self._PS.format(rate=rate)],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=flags,
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

def get_thresholds(mode='beginner'):
    """
    Lunge geometry (SIDE VIEW):

    FRONT KNEE ANGLE = joint angle at front knee (hip→knee→ankle)
      Standing      : 160–180°
      Moving        : 100–159°
      Good depth    :  80–99°   (beginner) /  85–99° (pro)
      Too deep      :  < 75°

    TORSO VERTICAL ANGLE = vert_angle(shoulder, hip)
      Good upright  : 5–25°  (slight forward lean is normal)
      Too forward   : > 30°
      Too backward  : < 3°

    FRONT KNEE OVER TOE:
      In side view: front knee x should NOT exceed front ankle x
      We measure how far knee is past ankle in normalized x-coords
      Threshold: knee_x - ankle_x > KNEE_TOE_THRESH

    BACK KNEE DROP (depth check):
      back_knee_y should be close to back_ankle_y in normalized coords
      (both near the floor)
      Good: back_knee_y > (back_ankle_y - BACK_KNEE_THRESH)

    STANCE DETECTION:
      Person is in a lunge when:
        - Feet are spread: abs(front_foot_x - back_foot_x) > STANCE_SPREAD
        - Front knee is bending (angle < 160°)
    """
    if mode == 'pro':
        return {
            'STATES': {
                's1': (155, 180),   # standing / resetting
                's2': (100, 154),   # moving / transitioning
                's3': ( 80,  99),   # at depth
            },
            'TORSO_FWD'        : 28,    # torso too forward (leaning)
            'TORSO_BACK'       : 3,     # torso too upright / falling back
            'KNEE_TOE_THRESH'  : 0.04,  # normalized: knee more than 4% past ankle
            'FRONT_KNEE_MIN'   : 78,    # too deep if angle < this
            'BACK_KNEE_THRESH' : 0.12,  # back knee must be within 12% of ankle height
            'STANCE_SPREAD'    : 0.18,  # normalized foot spread to detect lunge stance
            'OFFSET_THRESH'    : 35.0,
            'OFFSET_FRAMES'    : 15,
            'INACTIVE_THRESH'  : 15.0,
            'FB_FRAMES'        : 5,
        }
    else:
        return {
            'STATES': {
                's1': (155, 180),
                's2': (100, 154),
                's3': ( 75,  99),
            },
            'TORSO_FWD'        : 32,
            'TORSO_BACK'       : 3,
            'KNEE_TOE_THRESH'  : 0.05,
            'FRONT_KNEE_MIN'   : 70,
            'BACK_KNEE_THRESH' : 0.15,
            'STANCE_SPREAD'    : 0.15,
            'OFFSET_THRESH'    : 35.0,
            'OFFSET_FRAMES'    : 15,
            'INACTIVE_THRESH'  : 15.0,
            'FB_FRAMES'        : 5,
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
    Angle between segment p_top→p_bot and the vertical axis.
    0° = perfectly vertical. 90° = perfectly horizontal.
    """
    dx = float(p_bot[0]) - float(p_top[0])
    dy = float(p_bot[1]) - float(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def nose_angle(nose, l_sh, r_sh):
    """Camera alignment angle: nose vs shoulder midpoint."""
    mid = ((l_sh + r_sh) / 2).astype(float)
    v1  = (l_sh  - mid).astype(float)
    v2  = (nose  - mid).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def pxc(lm, idx, fw, fh):
    """Landmark → pixel coord."""
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
    'teal'    : (200, 210,   0),
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


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (on-screen label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('KNEE OVER TOE — PUSH KNEE BACK',      125, (180,  40,  40), 'knee_over_toe'),
    1: ('LEAN FORWARD — KEEP CHEST UP',        175, (20,   60, 200), 'lean_forward'),
    2: ('LEANING BACK — ENGAGE CORE',          175, (20,   60, 200), 'lean_back'),
    3: ('FRONT KNEE TOO DEEP — CONTROL IT',    225, (180,  40,  40), 'too_deep'),
    4: ('LOWER BACK KNEE TOWARD FLOOR',        225, (20,  120,  20), 'back_knee_high'),
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

class LungeProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            # ── rep state machine ─────────────────────────────────────
            seq          = [],
            prev_state   = None,
            bad_form     = False,

            # ── counters ──────────────────────────────────────────────
            correct      = 0,
            incorrect    = 0,

            # ── feedback debounce ─────────────────────────────────────
            fb_cnt       = np.zeros(5, int),
            fb_show      = np.zeros(5, bool),

            # ── voice phase tracking ──────────────────────────────────
            last_phase   = None,
            depth_said   = False,

            # ── camera ────────────────────────────────────────────────
            cam_cnt      = 0,

            # ── inactivity ────────────────────────────────────────────
            inactive     = 0.0,
            last_t       = time.perf_counter(),
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

        # ── All landmarks (pixel) ───────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');   r_sh  = G('r_sh')
        l_el  = G('l_el');   r_el  = G('r_el')
        l_wr  = G('l_wr');   r_wr  = G('r_wr')
        l_hip = G('l_hip');  r_hip = G('r_hip')
        l_kn  = G('l_kn');   r_kn  = G('r_kn')
        l_ank = G('l_ank');  r_ank = G('r_ank')
        l_ft  = G('l_ft');   r_ft  = G('r_ft')
        l_ear = G('l_ear');  r_ear = G('r_ear')

        # Normalized (for knee-over-toe and depth checks)
        nl_kn  = N('l_kn');  nr_kn  = N('r_kn')
        nl_ank = N('l_ank'); nr_ank = N('r_ank')
        nl_ft  = N('l_ft');  nr_ft  = N('r_ft')
        nl_hip = N('l_hip'); nr_hip = N('r_hip')
        nl_sh  = N('l_sh');  nr_sh  = N('r_sh')

        # ── Camera alignment ────────────────────────────────────────
        off_ang  = nose_angle(nose, l_sh, r_sh)
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

        # ── Determine FRONT and BACK legs ───────────────────────────
        #
        # In a side-view lunge:
        #   The FRONT leg steps forward → its foot has the larger x
        #   (or smaller x depending on which direction person faces)
        #   The FRONT knee bends to ~90° — it has the SMALLER knee angle
        #
        # Strategy:
        #   1. Compute both knee angles
        #   2. The leg with the SMALLER knee angle = FRONT leg
        #      (most bent = front leg in a lunge)
        #   3. If both angles > 155°, person is standing → use visibility
        #
        l_kn_ang = joint_angle(l_hip, l_kn, l_ank)
        r_kn_ang = joint_angle(r_hip, r_kn, r_ank)

        if l_kn_ang <= r_kn_ang:
            # Left leg is more bent → FRONT
            front_sh,  front_hip,  front_kn,  front_ank,  front_ft  = l_sh,  l_hip,  l_kn,  l_ank,  l_ft
            back_sh,   back_hip,   back_kn,   back_ank,   back_ft   = r_sh,  r_hip,  r_kn,  r_ank,  r_ft
            n_front_kn, n_front_ank, n_front_ft = nl_kn, nl_ank, nl_ft
            n_back_kn,  n_back_ank              = nr_kn, nr_ank
            n_front_hip, n_front_sh             = nl_hip, nl_sh
            ear = l_ear
            front_kn_ang = l_kn_ang
            back_kn_ang  = r_kn_ang
        else:
            # Right leg is more bent → FRONT
            front_sh,  front_hip,  front_kn,  front_ank,  front_ft  = r_sh,  r_hip,  r_kn,  r_ank,  r_ft
            back_sh,   back_hip,   back_kn,   back_ank,   back_ft   = l_sh,  l_hip,  l_kn,  l_ank,  l_ft
            n_front_kn, n_front_ank, n_front_ft = nr_kn, nr_ank, nr_ft
            n_back_kn,  n_back_ank              = nl_kn, nl_ank
            n_front_hip, n_front_sh             = nr_hip, nr_sh
            ear = r_ear
            front_kn_ang = r_kn_ang
            back_kn_ang  = l_kn_ang

        # ── Key measurements ─────────────────────────────────────────
        # 1. Torso vertical angle (should stay ~5–25°)
        torso_v = vert_angle(front_sh, front_hip)

        # 2. Front knee over toe check (normalized x)
        #    In side view: if front knee x > front ankle x → knee past toe
        #    We use normalized x so it's camera-distance independent
        #    The sign depends on which direction person faces:
        #    We compare horizontal offset of knee vs ankle
        knee_toe_dist = abs(n_front_kn[0] - n_front_ank[0])
        knee_past_toe = knee_toe_dist > self.T['KNEE_TOE_THRESH']

        # 3. Back knee depth check (normalized y)
        #    Good lunge: back knee should drop toward floor
        #    back_knee_y should approach back_ankle_y
        #    If back_knee_y is much higher than ankle_y → not deep enough
        back_knee_drop = n_back_ank[1] - n_back_kn[1]  # +ve = knee higher than ankle

        # 4. Foot spread (normalized) — are we actually in a lunge stance?
        foot_spread = abs(n_front_ft[0] - n_back_ank[0])
        in_lunge_stance = foot_spread > self.T['STANCE_SPREAD']

        # ── Form checks ─────────────────────────────────────────────
        bad = np.zeros(5, bool)

        # Only check form when actually lunging (not just standing)
        if front_kn_ang < 160 or in_lunge_stance:

            # [0] Front knee over toe
            if knee_past_toe and front_kn_ang < 150:
                bad[0] = True

            # [1] Torso leaning too far forward
            if torso_v > self.T['TORSO_FWD']:
                bad[1] = True

            # [2] Torso leaning too far backward
            if torso_v < self.T['TORSO_BACK'] and front_kn_ang < 150:
                bad[2] = True

            # [3] Front knee too deep (over-bending)
            if front_kn_ang < self.T['FRONT_KNEE_MIN']:
                bad[3] = True

            # [4] Back knee not dropping enough (only at s2/s3 depth)
            if front_kn_ang < 130 and back_knee_drop > self.T['BACK_KNEE_THRESH']:
                bad[4] = True

        # Mark bad form for this rep
        if bad[0] or bad[1] or bad[2] or bad[3]:
            self.S['bad_form'] = True

        # Debounce per flag
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FB_FRAMES']

        # ── Voice form errors (highest priority first) ──────────────
        for i in range(5):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine ───────────────────────────────────────────
        state = self._state(front_kn_ang)
        self._update_seq(state)

        # ── Voice phase coaching ────────────────────────────────────
        self._coach_phase(state, front_kn_ang, in_lunge_stance)

        # ── Rep counting ────────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and not self.S['bad_form']:
                # Perfect rep: s2 → s3 → s2
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Lunge #{n} — correct")
            elif 's3' not in seq and len(seq) >= 1:
                # Didn't reach depth
                self.S['incorrect'] += 1
                self.S['fb_cnt'][4] = self.T['FB_FRAMES'] + 1
                self.S['fb_show'][4] = True
                self.voice.say('too_shallow')
                print(f"❌  Too shallow")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")
            # Reset for next rep
            self.S['seq']       = []
            self.S['bad_form']  = False
            self.S['depth_said'] = False

        self.S['prev_state'] = state

        # ── Inactivity reset ────────────────────────────────────────
        now = time.perf_counter()
        if state == self.S['last_state_inact']:
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']          = 0.0
            self.S['last_state_inact']  = state
        self.S['last_t'] = now

        # ── Draw ─────────────────────────────────────────────────────
        self._draw_skeleton(frame,
                            front_sh, front_hip, front_kn, front_ank, front_ft,
                            back_sh,  back_hip,  back_kn,  back_ank,  back_ft,
                            ear)
        self._draw_front_leg(frame, front_sh, front_hip, front_kn,
                             front_ank, front_kn_ang, knee_past_toe)
        self._draw_back_leg(frame, back_hip, back_kn, back_ank,
                            back_kn_ang, back_knee_drop)
        self._draw_torso(frame, front_sh, front_hip, torso_v)
        self._draw_hud(frame, fw, state, front_kn_ang)
        self._draw_feedback(frame)

        # Live debug readout
        cv2.putText(frame,
            f'FRONT_KN:{front_kn_ang}  BACK_KN:{back_kn_ang}  '
            f'TORSO:{torso_v}  KOT:{int(knee_toe_dist*100)}%  '
            f'BKDROP:{int(back_knee_drop*100)}%  STATE:{state}',
            (10, fh - 12), FONT, 0.32, (100, 100, 100), 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, front_kn_ang):
        """
        State based on FRONT knee angle.
          s1 = standing  (155–180°)
          s2 = moving    (100–154°)
          s3 = at depth  (75–99°  beginner / 80–99° pro)
        Gap-free: clamp to nearest state so no 'None' gaps.
        """
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= front_kn_ang <= hi:
                return name
        # Clamp to nearest — no dead zones
        if front_kn_ang > self.T['STATES']['s1'][0]:
            return 's1'
        if front_kn_ang > self.T['STATES']['s2'][0]:
            return 's2'
        return 's3'

    def _update_seq(self, state):
        """Track s2 → s3 → s2 sequence for rep counting."""
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

    def _coach_phase(self, state, front_kn_ang, in_lunge_stance):
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Entering mid on way DOWN
            self.voice.say('going_down')

        elif state == 's3':
            # Reached full depth
            if not self.S['depth_said']:
                self.S['depth_said'] = True
                self.voice.say('at_depth')

        elif state == 's2' and 's3' in self.S['seq']:
            # Coming back UP through mid
            self.voice.say('coming_up')

        elif state == 's1' and self.S['prev_state'] == 's2':
            # Back to standing
            self.voice.say('at_top')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame,
                       f_sh, f_hip, f_kn, f_ank, f_ft,
                       b_sh, b_hip, b_kn, b_ank, b_ft,
                       ear):
        # Front leg (brighter)
        for a, b in [(f_sh,f_hip),(f_hip,f_kn),(f_kn,f_ank),(f_ank,f_ft)]:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 4, AA)
        # Back leg (dimmer teal)
        for a, b in [(b_sh,b_hip),(b_hip,b_kn),(b_kn,b_ank),(b_ank,b_ft)]:
            cv2.line(frame, tuple(a), tuple(b), C['teal'], 2, AA)
        # Torso
        cv2.line(frame, tuple(f_sh), tuple(b_sh), C['lt_blue'], 3, AA)
        # Joints
        for pt in (f_sh, f_hip, f_kn, f_ank, f_ft):
            cv2.circle(frame, tuple(pt), 7, C['yellow'], -1, AA)
        for pt in (b_sh, b_hip, b_kn, b_ank, b_ft):
            cv2.circle(frame, tuple(pt), 5, C['cyan'], -1, AA)
        # Ear
        cv2.circle(frame, tuple(ear), 5, C['white'], -1, AA)

    def _draw_front_leg(self, frame, sh, hip, kn, ank, kn_ang, knee_past_toe):
        """Draw front leg with colored segments based on form."""
        T = self.T

        # Knee color
        if kn_ang < T['FRONT_KNEE_MIN']:
            kn_col = C['red']      # too deep
        elif kn_ang <= T['STATES']['s3'][1]:
            kn_col = C['green']    # perfect depth
        elif kn_ang <= T['STATES']['s2'][1]:
            kn_col = C['yellow']   # moving
        else:
            kn_col = C['lt_blue']  # standing

        # Knee-over-toe indicator
        kot_col = C['red'] if knee_past_toe else kn_col
        cv2.line(frame, tuple(hip), tuple(kn),  kn_col,  3, AA)
        cv2.line(frame, tuple(kn),  tuple(ank), kot_col, 3, AA)

        # Knee angle label
        cv2.putText(frame, f'{kn_ang}°',
                    (kn[0]+12, kn[1]),
                    FONT, 0.56, kn_col, 2, AA)

        # Knee-over-toe vertical guide line
        dotted_v(frame, ank, ank[1]-100, ank[1]+10, C['blue'])
        cv2.putText(frame, 'TOE LINE',
                    (ank[0]+8, ank[1]-105),
                    FONT, 0.36, C['blue'], 1, AA)

    def _draw_back_leg(self, frame, hip, kn, ank, kn_ang, back_drop):
        """Draw back leg angle and depth indicator."""
        T = self.T
        deep_enough = back_drop <= T['BACK_KNEE_THRESH']
        col = C['green'] if deep_enough else C['orange']

        cv2.putText(frame, f'BACK:{kn_ang}°',
                    (kn[0]+10, kn[1]-10),
                    FONT, 0.46, col, 2, AA)

        # Back knee floor-drop progress
        drop_pct = max(0.0, min(1.0, 1.0 - back_drop / max(T['BACK_KNEE_THRESH'], 0.01)))
        bx, by, bw, bh = 10, 140, 12, 80
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30,30,30), -1)
        fill = int(drop_pct * bh)
        if fill > 0:
            cv2.rectangle(frame,
                          (bx, by+bh-fill), (bx+bw, by+bh),
                          col, -1)
        cv2.putText(frame, 'BK',
                    (bx, by+bh+14), FONT, 0.36, (100,100,100), 1, AA)

    def _draw_torso(self, frame, sh, hip, torso_v):
        """Torso line colored by lean."""
        T = self.T
        if torso_v > T['TORSO_FWD']:
            col = C['red']
        elif torso_v < T['TORSO_BACK']:
            col = C['orange']
        else:
            col = C['green']
        cv2.line(frame, tuple(sh), tuple(hip), col, 3, AA)
        cv2.putText(frame, f'TORSO:{torso_v}°',
                    (sh[0]+10, sh[1]-10),
                    FONT, 0.46, col, 2, AA)

    def _draw_hud(self, frame, fw, state, front_kn_ang):
        phase_txt = {
            's1': 'STANDING',
            's2': 'MOVING',
            's3': 'AT DEPTH',
        }.get(state, '---')
        p_col = {
            's1': (0, 120,  0),
            's2': (0, 120, 170),
            's3': (0,  50, 190),
        }.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}',   30, 34, bg=p_col)
        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw * 0.68), 84, bg=(180, 20, 20))

        # Lunge depth bar (front knee angle 180→s3 low)
        s3_target = self.T['STATES']['s3'][1]   # e.g. 99
        pct = max(0.0, min(1.0,
                           (180 - front_kn_ang) / max(180 - s3_target, 1)))
        bx, by, bw, bh = 30, 55, 180, 8
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30,30,30), -1)
        fill = int(pct * bw)
        if fill > 0:
            col = (0,200,80) if pct < 1.0 else (0,255,180)
            cv2.rectangle(frame, (bx, by), (bx+fill, by+bh), col, -1)
        cv2.putText(frame, 'DEPTH', (bx, by+bh+14),
                    FONT, 0.38, (100,100,100), 1, AA)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP',
                30, 88, scale=0.50, bg=(180, 20, 20))

    def _draw_feedback(self, frame):
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.58,
                    fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']),
                        (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 180)
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
        self._draw_hud(frame, fw, None, 180)
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
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='AI Lunge Analyzer')
    ap.add_argument('--video',  default=None,
                    help='Path to video file (omit to use webcam)')
    ap.add_argument('--mode',   default='beginner',
                    choices=['beginner', 'pro'])
    ap.add_argument('--flip',   action='store_true',
                    help='Flip webcam horizontally (mirror mode)')
    ap.add_argument('--mute',   action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',  type=int, default=5,
                    help='Speech speed 1-10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = LungeProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"🦵  Lunge Analyzer  [{args.mode.upper()}]")
    print("    Camera : SIDE VIEW at hip height")
    print("    Lunge  : Step FORWARD or BACKWARD, lower back knee toward floor")
    print("    Press  Q  to quit\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Lunge Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        print(f"\n── Session Results ─────────────────")
        print(f"  ✅  Correct   : {proc.S['correct']}")
        print(f"  ❌  Incorrect : {proc.S['incorrect']}")


if __name__ == '__main__':
    main()