"""
AI Fitness Trainer - Squat Analyzer  (v3 — full rewrite)
==========================================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python squat_analyzer.py
    python squat_analyzer.py --mode pro
    python squat_analyzer.py --flip --mute
    python squat_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at hip/waist height. Full body visible in profile.

What it tracks:
  • Rep counting  (correct vs incorrect)
  • Torso leaning too far forward
  • Torso leaning too far backward
  • Knee caving over toe
  • Squat too shallow (didn't reach depth)
  • Squat too deep
  • Feet placement issues

Voice coaches every phase:
  Starting descent → at depth → coming up → rep complete → all form errors
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
        'camera'         : "Stand sideways to the camera.",
        'reset'          : "Counters reset.",
        # ── phase coaching ───────────────────────────────────────────
        'going_down'     : "Going down. Control the descent.",
        'at_depth'       : "Good depth. Now drive up.",
        'coming_up'      : "Drive through your heels.",
        'at_top'         : "Stand tall. Lock it out.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'       : "Good squat!",
        'too_shallow'    : "Too shallow. Squat deeper next time.",
        'bad_form_rep'   : "Rep not counted. Fix your form.",
        # ── form errors (spoken immediately) ─────────────────────────
        'bend_forward'   : "Leaning too far forward. Keep chest up.",
        'bend_back'      : "Leaning back. Engage your core.",
        'knee_toe'       : "Knee over toe! Push knee outward.",
        'too_deep'       : "Too deep! Control your depth.",
        'lower_hips'     : "Lower your hips. Squat deeper.",
        'feet_wide'      : "Feet too wide. Adjust your stance.",
        'heels_up'       : "Keep heels on the floor.",
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
        'camera'        : 7.0,
        'reset'         : 5.0,
        'going_down'    : 2.5,
        'at_depth'      : 2.0,
        'coming_up'     : 2.0,
        'at_top'        : 2.5,
        'good_rep'      : 1.5,
        'too_shallow'   : 3.0,
        'bad_form_rep'  : 3.0,
        'bend_forward'  : 4.0,
        'bend_back'     : 4.0,
        'knee_toe'      : 4.0,
        'too_deep'      : 4.0,
        'lower_hips'    : 3.0,
        'feet_wide'     : 5.0,
        'heels_up'      : 4.0,
    }

    # SpeakAsync + CancelAll = instant interruption of current phrase
    _PS = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "$s.Rate = {rate}; "
        "while ($true) {{ "
        "  $line = [Console]::ReadLine(); "
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
    Squat uses VERTICAL angles — angle between a body segment and the
    vertical axis (a reference line straight up from the joint).

    knee_v_angle = vertical angle of hip→knee segment
      s1 STANDING : 0–32°   (nearly vertical = standing)
      s2 MOVING   : 33–69°  (mid-descent or mid-ascent)
      s3 DEPTH    : 70–95°  beginner / 80–95° pro  (full squat depth)

    hip_v_angle = vertical angle of shoulder→hip segment (torso lean)
      Too forward : < HIP_FWD  (10° beginner / 15° pro)
      Too backward: > HIP_BACK (50°)

    ankle_v_angle = vertical angle of knee→ankle segment
      Knee over toe: > ANKLE_THRESH

    All thresholds use NORMALIZED coordinates for camera-independence.
    """
    if mode == 'pro':
        return {
            'STATES': {
                's1': (0,  32),    # standing
                's2': (33, 79),    # moving
                's3': (80, 100),   # full depth
            },
            'HIP_FWD'       : 15,    # torso too vertical → falling back
            'HIP_BACK'      : 50,    # torso leaning forward
            'ANKLE_THRESH'  : 30,    # knee over toe
            'KNEE_DEEP'     : 100,   # too deep
            'OFFSET_THRESH' : 35.0,
            'OFFSET_FRAMES' : 15,
            'INACTIVE_THRESH': 15.0,
            'FB_FRAMES'     : 5,
        }
    else:
        return {
            'STATES': {
                's1': (0,  32),
                's2': (33, 69),
                's3': (70, 100),
            },
            'HIP_FWD'       : 10,
            'HIP_BACK'      : 50,
            'ANKLE_THRESH'  : 45,
            'KNEE_DEEP'     : 100,
            'OFFSET_THRESH' : 35.0,
            'OFFSET_FRAMES' : 15,
            'INACTIVE_THRESH': 15.0,
            'FB_FRAMES'     : 5,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
# ══════════════════════════════════════════════════════════════════════

def vert_angle(p_top, p_bot):
    """
    Vertical angle of the segment p_top→p_bot.
    Returns angle (degrees) between segment and the vertical axis.
    0° = perfectly vertical (segment pointing straight down).
    """
    dx = int(p_bot[0]) - int(p_top[0])
    dy = int(p_bot[1]) - int(p_top[1])
    # Angle from vertical: atan2(|dx|, dy)
    angle = np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9))
    return int(angle)


def joint_angle(p1, p2, p3):
    """Standard joint angle at p2 (degrees, 0-180)."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def nose_shoulder_angle(nose, l_sh, r_sh):
    """Camera alignment: angle at shoulder midpoint between nose and each shoulder."""
    mid = ((l_sh + r_sh) / 2).astype(float)
    v1  = (l_sh - mid).astype(float)
    v2  = (nose  - mid).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def px(lm, idx, fw, fh):
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


# ══════════════════════════════════════════════════════════════════════
#  DRAWING
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
    'purple'  : (200,  50, 200),
}


def rr(img, x1, y1, x2, y2, r, color):
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


def angle_arc(img, vertex, p1, p2, color, r=22):
    """Draw arc showing angle at vertex between p1 and p2."""
    v1 = (p1 - vertex).astype(float)
    v2 = (p2 - vertex).astype(float)
    sa = int(np.degrees(np.arctan2(v1[1], v1[0])))
    ea = int(np.degrees(np.arctan2(v2[1], v2[0])))
    cv2.ellipse(img, tuple(vertex.astype(int)), (r, r), 0, sa, ea, color, 2, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (label, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('LEANING FORWARD — KEEP CHEST UP',  125, (0,   80, 210), 'bend_forward'),
    1: ('LEANING BACK — ENGAGE CORE',       125, (0,   80, 210), 'bend_back'),
    2: ('KNEE OVER TOE — PUSH KNEE OUT',    175, (180,  40,  40), 'knee_toe'),
    3: ('SQUAT TOO DEEP — CONTROL DEPTH',   225, (180,  40,  40), 'too_deep'),
    4: ('LOWER HIPS — SQUAT DEEPER',        225, (20,  130,  20), 'lower_hips'),
}


# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES
# ══════════════════════════════════════════════════════════════════════

LM = dict(nose=0, l_ear=7, r_ear=8,
          l_sh=11, r_sh=12, l_el=13, r_el=14, l_wr=15, r_wr=16,
          l_hip=23, r_hip=24, l_kn=25, r_kn=26,
          l_ank=27, r_ank=28, l_ft=31, r_ft=32)


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class SquatProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            # ── rep state machine ─────────────────────────────────────
            seq         = [],
            prev_state  = None,
            bad_form    = False,

            # ── counters ──────────────────────────────────────────────
            correct     = 0,
            incorrect   = 0,

            # ── feedback ──────────────────────────────────────────────
            fb_cnt      = np.zeros(5, int),
            fb_show     = np.zeros(5, bool),

            # ── voice phase ───────────────────────────────────────────
            last_phase  = None,
            depth_said  = False,

            # ── camera ────────────────────────────────────────────────
            cam_cnt     = 0,

            # ── inactivity ────────────────────────────────────────────
            inactive    = 0.0,
            last_t      = time.perf_counter(),
            last_state_for_inact = None,
        )

    # ─────────────────────────────────────────────────────────────────
    def process(self, frame, pose):
        fh, fw = frame.shape[:2]
        res    = pose.process(frame)

        if not res.pose_landmarks:
            self._no_person(frame, fw)
            return frame

        lm = res.pose_landmarks.landmark
        G  = lambda k: px(lm, LM[k], fw, fh)
        V  = lambda k: lm[LM[k]].visibility

        # ── Landmarks ──────────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');  r_sh  = G('r_sh')
        l_el  = G('l_el');  r_el  = G('r_el')
        l_wr  = G('l_wr');  r_wr  = G('r_wr')
        l_hip = G('l_hip'); r_hip = G('r_hip')
        l_kn  = G('l_kn');  r_kn  = G('r_kn')
        l_ank = G('l_ank'); r_ank = G('r_ank')
        l_ft  = G('l_ft');  r_ft  = G('r_ft')

        # ── Camera alignment ───────────────────────────────────────
        off_ang = nose_shoulder_angle(nose, l_sh, r_sh)
        sp_px   = abs(int(l_sh[0]) - int(r_sh[0]))
        vis_diff= abs(V('l_sh') - V('r_sh'))
        is_front = (off_ang > self.T['OFFSET_THRESH']
                    and sp_px > fw * 0.18
                    and vis_diff < 0.25)
        self.S['cam_cnt'] = self.S['cam_cnt'] + 1 if is_front else 0
        if self.S['cam_cnt'] >= self.T['OFFSET_FRAMES']:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_front:
            self.S['cam_cnt'] = 0

        # ── Pick visible side (MediaPipe visibility) ───────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh, el, wr   = l_sh, l_el, l_wr
            hip, kn, ank = l_hip, l_kn, l_ank
            ft           = l_ft
        else:
            sh, el, wr   = r_sh, r_el, r_wr
            hip, kn, ank = r_hip, r_kn, r_ank
            ft           = r_ft

        # ── Vertical angles ────────────────────────────────────────
        # knee_v : angle of hip→knee segment from vertical
        # hip_v  : angle of shoulder→hip segment from vertical (torso lean)
        # ankle_v: angle of knee→ankle segment from vertical (knee over toe)
        knee_v  = vert_angle(hip, kn)
        hip_v   = vert_angle(sh,  hip)
        ankle_v = vert_angle(kn,  ank)

        # ── State ──────────────────────────────────────────────────
        state = self._state(knee_v)
        self._update_seq(state)

        # ── Form checks ────────────────────────────────────────────
        bad = np.zeros(5, bool)

        # Torso leaning forward (hip_v too small = torso too upright falling back)
        if hip_v < self.T['HIP_FWD'] and state in ('s2', 's3'):
            bad[0] = True

        # Torso leaning too far back (hip_v too large)
        if hip_v > self.T['HIP_BACK']:
            bad[1] = True

        # Knee caving over toe
        if ankle_v > self.T['ANKLE_THRESH']:
            bad[2] = True

        # Squat too deep
        if knee_v > self.T['KNEE_DEEP']:
            bad[3] = True

        # Need to go deeper (in s2 on the way down — show "lower hips")
        in_descent = 's2' in self.S['seq'] and 's3' not in self.S['seq']
        if in_descent and state == 's2' and knee_v < self.T['STATES']['s3'][0]:
            bad[4] = True    # encourage to go lower

        # Mark bad form this rep
        if bad[0] or bad[1] or bad[2] or bad[3]:
            self.S['bad_form'] = True

        # Debounce per flag
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FB_FRAMES']

        # ── Voice form errors (highest priority first) ─────────────
        for i in range(5):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── Phase voice coaching ───────────────────────────────────
        self._coach_phase(state, knee_v)

        # ── Rep counting ───────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and not self.S['bad_form']:
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Squat #{n} — correct")
            elif 's3' not in seq and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.S['fb_cnt'][4] = self.T['FB_FRAMES'] + 1
                self.S['fb_show'][4] = True
                self.voice.say('too_shallow')
                print(f"❌  Too shallow")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form")
            # Reset
            self.S['seq']       = []
            self.S['bad_form']  = False
            self.S['depth_said'] = False

        self.S['prev_state'] = state

        # ── Inactivity ─────────────────────────────────────────────
        now = time.perf_counter()
        if state == self.S['last_state_for_inact']:
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']           = 0.0
            self.S['last_state_for_inact'] = state
        self.S['last_t'] = now

        # ── Draw ───────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip, kn, ank, ft)
        self._draw_angles(frame, sh, hip, kn, ank,
                          hip_v, knee_v, ankle_v)
        self._draw_hud(frame, fw, state, knee_v)
        self._draw_feedback(frame)

        # Live angle readouts bottom of screen
        cv2.putText(frame,
                    f'HIP_V:{hip_v}  KNEE_V:{knee_v}  ANKLE_V:{ankle_v}  STATE:{state}',
                    (10, fh-12), FONT, 0.36, (110,110,110), 1, AA)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, knee_v):
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= knee_v <= hi:
                return name
        # If between states, return the nearest one
        if knee_v < self.T['STATES']['s1'][1]:
            return 's1'
        if knee_v < self.T['STATES']['s2'][1]:
            return 's2'
        return 's3'

    def _update_seq(self, state):
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

    def _coach_phase(self, state, knee_v):
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Entering mid going DOWN
            self.voice.say('going_down')

        elif state == 's3':
            # Reached depth
            if not self.S['depth_said']:
                self.S['depth_said'] = True
                self.voice.say('at_depth')

        elif state == 's2' and 's3' in self.S['seq']:
            # Coming back UP
            self.voice.say('coming_up')

        elif state == 's1' and self.S['prev_state'] == 's2':
            # Back to standing
            self.voice.say('at_top')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip, kn, ank, ft):
        bones = [(sh,el),(el,wr),(sh,hip),(hip,kn),(kn,ank),(ank,ft)]
        for a, b in bones:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 4, AA)
        for pt in (sh, el, wr, hip, kn, ank, ft):
            cv2.circle(frame, tuple(pt), 7, C['yellow'], -1, AA)

    def _draw_angles(self, frame, sh, hip, kn, ank,
                     hip_v, knee_v, ankle_v):
        """Draw vertical reference lines + colored arcs + angle values."""
        T = self.T

        # Vertical reference dotted lines
        for pt, h in [(hip, 80), (kn, 50), (ank, 50)]:
            dotted_v(frame, pt, pt[1]-h, pt[1]+20, C['blue'])

        # Color hip arc
        hip_col = (C['red'] if hip_v > T['HIP_BACK'] or
                   (hip_v < T['HIP_FWD']) else C['green'])
        # Color knee arc
        kn_col  = (C['red'] if knee_v > T['KNEE_DEEP']
                   else C['green'] if knee_v >= T['STATES']['s3'][0]
                   else C['yellow'])
        # Color ankle arc
        ank_col = C['red'] if ankle_v > T['ANKLE_THRESH'] else C['green']

        # Vertical reference vector (straight up from each joint)
        for pt, ref_top, col, val, offset in [
            (hip, np.array([hip[0], hip[1]-60]),  hip_col,  hip_v,   (12, 0)),
            (kn,  np.array([kn[0],  kn[1]-50]),   kn_col,   knee_v,  (15, 10)),
            (ank, np.array([ank[0], ank[1]-50]),   ank_col,  ankle_v, (12, 0)),
        ]:
            cv2.line(frame, tuple(ref_top), tuple(pt), (80,80,80), 1, AA)
            cv2.putText(frame, f'{val}°',
                        (pt[0]+offset[0], pt[1]+offset[1]),
                        FONT, 0.54, col, 2, AA)

        # Draw colored body segments based on form
        kn_col2 = C['red'] if knee_v > T['KNEE_DEEP'] else C['green']
        ank_col2= C['red'] if ankle_v > T['ANKLE_THRESH'] else C['green']
        cv2.line(frame, tuple(hip), tuple(kn),  kn_col2,  3, AA)
        cv2.line(frame, tuple(kn),  tuple(ank), ank_col2, 3, AA)

    def _draw_hud(self, frame, fw, state, knee_v):
        phase_txt = {'s1':'STANDING', 's2':'MOVING', 's3':'AT DEPTH'}.get(state, '---')
        p_col = {'s1':(0,130,0), 's2':(0,130,180), 's3':(0,60,200)}.get(state, C['dark'])

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)
        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw*0.68), 34, bg=(0,140,0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw*0.68), 84, bg=(180,20,20))

        # Squat depth progress bar
        s3_lo = self.T['STATES']['s3'][0]
        s3_hi = self.T['STATES']['s3'][1]
        pct   = min(max(knee_v - self.T['STATES']['s1'][1], 0) /
                    max(s3_lo - self.T['STATES']['s1'][1], 1), 1.0)
        bx, by, bw, bh = 30, 55, 180, 8
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30,30,30), -1)
        fill = int(pct * bw)
        if fill > 0:
            col = (0,200,80) if pct < 1.0 else (0,255,180)
            cv2.rectangle(frame, (bx, by), (bx+fill, by+bh), col, -1)
        cv2.putText(frame, 'DEPTH', (bx, by+bh+14), FONT, 0.38, (100,100,100), 1, AA)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 88, scale=0.50, bg=(180,20,20))

    def _draw_feedback(self, frame):
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.58, fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose,C['white']),(l_sh,C['yellow']),(r_sh,C['magenta'])]:
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
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--video',  default=None)
    ap.add_argument('--mode',   default='beginner', choices=['beginner','pro'])
    ap.add_argument('--flip',   action='store_true')
    ap.add_argument('--mute',   action='store_true')
    ap.add_argument('--speed',  type=int, default=5)
    args = ap.parse_args()

    T     = get_thresholds(args.mode)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = SquatProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"🏋  Squat Analyzer  [{args.mode.upper()}]")
    print("    Camera: SIDE VIEW at hip height   |   Q = quit\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Squat Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        print(f"\n── Results ──────────────────────")
        print(f"  ✅  Correct   : {proc.S['correct']}")
        print(f"  ❌  Incorrect : {proc.S['incorrect']}")


if __name__ == '__main__':
    main()