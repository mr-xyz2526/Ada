"""
AI Fitness Trainer - Barbell Bench Press Analyzer  (v1)
========================================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python bench_press_analyzer.py
    python bench_press_analyzer.py --mode pro
    python bench_press_analyzer.py --flip --mute
    python bench_press_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at bench height, perpendicular to your body.
Full upper body (shoulder → wrist) must be visible in profile.

╔══════════════════════════════════════════════════════════════════╗
║  ACCURATE ANGLES TRACKED  (sports-science / biomechanics)        ║
╠══════════════════════════════════════════════════════════════════╣
║  ELBOW JOINT ANGLE  (shoulder → elbow → wrist)                   ║
║    LOCKOUT   :  160–180°  full arm extension (avoid lock-out)    ║
║    MOVING    :   88–159°  mid press                              ║
║    AT CHEST  :   55–87°   bar touches / brushes chest            ║
║  ─────────────────────────────────────────────────────────────── ║
║  UPPER ARM VERTICAL ANGLE  (shoulder → elbow from vertical)      ║
║    Ideal     :   0–20°   arm nearly perpendicular to bench       ║
║    Warning   :  21–30°   slight drift                            ║
║    Bad       :   >30°   bar drifting toward face or belly        ║
║  ─────────────────────────────────────────────────────────────── ║
║  WRIST STACK  (wrist x offset from elbow x)                      ║
║    Good      :   <6%  frame width  (stacked)                     ║
║    Warning   :   >8%  frame width  (bent wrist, injury risk)     ║
╚══════════════════════════════════════════════════════════════════╝

What it detects:
  • Rep counting  (correct vs incorrect)
  • Bar path drifting toward face (elbows too far forward)
  • Bar path drifting toward belly (elbows too far back)
  • Wrist not stacked over elbow
  • Incomplete ROM (bar did not reach chest)
  • Missing lockout at the top

Voice coaches every phase:
  Descent → at chest → press → lockout → rep count → all form errors
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
#  Same PowerShell SpeakAsync architecture as squat analyzer
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ─────────────────────────────────────────
        'camera'         : "Lie on the bench sideways to the camera.",
        'reset'          : "Counters reset.",
        # ── phase coaching ─────────────────────────────────────────
        'going_down'     : "Lowering the bar. Control the descent.",
        'at_chest'       : "Good depth. Now press up.",
        'coming_up'      : "Drive the bar. Push through your chest.",
        'at_top'         : "Lockout. Great rep.",
        # ── rep results ────────────────────────────────────────────
        'good_rep'       : "Good press!",
        'too_shallow'    : "Too shallow. Lower the bar to your chest next time.",
        'bad_form_rep'   : "Rep not counted. Fix your form.",
        # ── form errors (spoken immediately) ───────────────────────
        'elbows_fwd'     : "Elbows drifting forward. Keep the bar over your chest.",
        'elbows_back'    : "Elbows too far back. Slight forward lean helps.",
        'wrist_bent'     : "Wrist not stacked over elbow. Risk of wrist pain.",
        'no_lockout'     : "Lock out your arms fully at the top.",
        'no_depth'       : "Lower the bar to your chest for full range.",
        # ── rep milestones ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Keep going!",
        '5'  : "5 reps. Solid set!",
        '10' : "10 reps. Strong work!",
        '15' : "15 reps. Incredible!",
        '20' : "20 reps. Beast mode!",
    }

    _COOLDOWN = {
        'camera'      : 7.0,
        'reset'       : 5.0,
        'going_down'  : 2.5,
        'at_chest'    : 2.0,
        'coming_up'   : 2.0,
        'at_top'      : 2.5,
        'good_rep'    : 1.5,
        'too_shallow' : 3.0,
        'bad_form_rep': 3.0,
        'elbows_fwd'  : 4.0,
        'elbows_back' : 4.0,
        'wrist_bent'  : 4.0,
        'no_lockout'  : 3.0,
        'no_depth'    : 3.0,
    }

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
        """Speak with per-key cooldown."""
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
        """Bypass cooldown — for rep count milestones."""
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
    Bench Press uses ELBOW JOINT ANGLE as primary metric:

      elbow_angle = angle at elbow (shoulder → elbow → wrist), range 0–180°

      s1  LOCKOUT : 160–180°   arms fully extended, slight soft lock
      s2  MOVING  :  88–159°   mid descent or mid press
      s3  AT CHEST:  55–87°    bar at / near chest — full ROM

    Upper arm is assessed with vert_angle(sh, el):
      angle of upper arm from the vertical (press direction) in the image.
      0° = arm straight up (perfect), >30° = drifting forward or back.

    Wrist stack is assessed with |wr.x – el.x| / frame_width:
      0–5%  = well stacked (wrist over elbow)
      >8%   = bent wrist warning
    """
    if mode == 'pro':
        return {
            # ── state machine ──────────────────────────────────────
            'STATES': {
                's1': (160, 180),   # LOCKOUT
                's2': ( 90, 159),   # MOVING
                's3': ( 55,  89),   # AT CHEST
            },
            # ── upper arm deviation from vertical ──────────────────
            # forward = bar toward face, back = bar toward belly
            'ARM_DEV_THRESH'    : 25,    # degrees; beyond this = form error
            # ── wrist stack ────────────────────────────────────────
            'WRIST_STACK_THRESH': 0.06,  # fraction of frame width
            # ── camera / orientation ───────────────────────────────
            'BODY_HORIZ_MIN'    : 48,    # vert_angle(sh,hip) must exceed this
                                         # to confirm person is lying down
            'OFFSET_FRAMES'     : 15,    # consecutive frames to trigger warn
            # ── timing ─────────────────────────────────────────────
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 5,     # debounce frames for feedback flags
        }
    else:   # beginner
        return {
            'STATES': {
                's1': (158, 180),
                's2': ( 88, 157),
                's3': ( 58,  87),
            },
            'ARM_DEV_THRESH'    : 30,
            'WRIST_STACK_THRESH': 0.08,
            'BODY_HORIZ_MIN'    : 44,
            'OFFSET_FRAMES'     : 15,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 5,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
# ══════════════════════════════════════════════════════════════════════

def joint_angle(p1, p2, p3) -> int:
    """
    True joint angle at vertex p2 between rays p2→p1 and p2→p3.
    Returns degrees in range [0, 180].
    """
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def vert_angle(p_top, p_bot) -> int:
    """
    Angle (degrees) of the segment p_top→p_bot from the image's vertical axis.
    0° = segment points straight down.  90° = segment is horizontal.
    Used for:
      • vert_angle(sh, el)  → upper arm deviation from vertical (press direction)
      • vert_angle(sh, hip) → body orientation check (>45° = lying horizontal)
    """
    dx = int(p_bot[0]) - int(p_top[0])
    dy = int(p_bot[1]) - int(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def signed_elbow_fwd(el, sh, head_dir: int) -> float:
    """
    Signed horizontal deviation of elbow from shoulder, in pixels.
    Positive = elbow is toward the face (bar path too high/forward).
    Negative = elbow is toward the feet (bar path too low/back).
    head_dir: +1 if head is to the right in image, -1 if head is to the left.
    """
    return (int(el[0]) - int(sh[0])) * (-head_dir)


def px(lm, idx, fw, fh):
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


# ══════════════════════════════════════════════════════════════════════
#  DRAWING HELPERS  (identical to squat analyzer)
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
    """Draw filled rounded rectangle."""
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r), color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),   color, -1)
    cv2.rectangle(img, (x1,   y1+r), (x1+r, y2-r), color, -1)
    cv2.rectangle(img, (x2-r, y1+r), (x2,   y2-r), color, -1)
    cv2.rectangle(img, (x1+r, y1+r), (x2-r, y2-r), color, -1)
    for cx, cy, sa, ea in [(x1+r,y1+r,180,270),(x2-r,y1+r,270,360),
                            (x1+r,y2-r, 90,180),(x2-r,y2-r,  0, 90)]:
        cv2.ellipse(img, (cx, cy), (r, r), 0, sa, ea, color, -1)


def lbl(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    """Draw text on a filled rounded-rectangle badge."""
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_v(img, pt, y0, y1, color, gap=8):
    """Draw dotted vertical line at pt.x from y0 to y1."""
    for y in range(min(y0, y1), max(y0, y1), gap):
        cv2.circle(img, (int(pt[0]), y), 2, color, -1, AA)


def angle_arc(img, vertex, p1, p2, color, r=26):
    """Draw arc at vertex showing the angle between directions to p1 and p2."""
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
    0: ('ELBOWS TOWARD FACE — PRESS OVER CHEST',   125, (0,  80, 210), 'elbows_fwd'),
    1: ('ELBOWS TOO FAR BACK — ADJUST BAR PATH',   175, (0,  80, 210), 'elbows_back'),
    2: ('WRIST NOT STACKED — RISK OF WRIST PAIN',  225, (180, 40,  40), 'wrist_bent'),
    3: ('INCOMPLETE ROM — LOWER BAR TO CHEST',     275, (180, 40,  40), 'no_depth'),
    4: ('NO LOCKOUT — EXTEND ARMS FULLY AT TOP',   325, (20, 130,  20), 'no_lockout'),
}


# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES  (MediaPipe)
# ══════════════════════════════════════════════════════════════════════

LM = dict(
    nose=0,
    l_sh=11, r_sh=12,
    l_el=13, r_el=14,
    l_wr=15, r_wr=16,
    l_hip=23, r_hip=24,
)


# ══════════════════════════════════════════════════════════════════════
#  BENCH PRESS PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class BenchPressProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            # ── rep state machine ─────────────────────────────────
            seq          = [],
            prev_state   = None,
            bad_form     = False,

            # ── counters ─────────────────────────────────────────
            correct      = 0,
            incorrect    = 0,

            # ── feedback ─────────────────────────────────────────
            fb_cnt       = np.zeros(5, int),
            fb_show      = np.zeros(5, bool),

            # ── voice phase ───────────────────────────────────────
            last_phase   = None,
            depth_said   = False,

            # ── camera orientation ───────────────────────────────
            cam_cnt      = 0,

            # ── inactivity auto-reset ─────────────────────────────
            inactive     = 0.0,
            last_t       = time.perf_counter(),
            last_state_for_inact = None,
        )

    # ──────────────────────────────────────────────────────────────────
    #  MAIN PROCESS LOOP
    # ──────────────────────────────────────────────────────────────────

    def process(self, frame, pose):
        fh, fw = frame.shape[:2]
        res    = pose.process(frame)

        if not res.pose_landmarks:
            self._no_person(frame, fw)
            return frame

        lm = res.pose_landmarks.landmark
        G  = lambda k: px(lm, LM[k], fw, fh)
        V  = lambda k: lm[LM[k]].visibility

        # ── Landmarks ────────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');  r_sh  = G('r_sh')
        l_el  = G('l_el');  r_el  = G('r_el')
        l_wr  = G('l_wr');  r_wr  = G('r_wr')
        l_hip = G('l_hip'); r_hip = G('r_hip')

        # ── Pick more-visible side ────────────────────────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh, el, wr, hip = l_sh, l_el, l_wr, l_hip
        else:
            sh, el, wr, hip = r_sh, r_el, r_wr, r_hip

        # ── Camera orientation check ─────────────────────────────
        # vert_angle(sh, hip) > BODY_HORIZ_MIN means body is lying horizontally
        body_h   = vert_angle(sh, hip)
        vis_diff = abs(V('l_sh') - V('r_sh'))
        # Not lying down OR both shoulders equally visible (head-on view)
        is_wrong = (body_h < self.T['BODY_HORIZ_MIN']) or (vis_diff < 0.12)
        self.S['cam_cnt'] = self.S['cam_cnt'] + 1 if is_wrong else 0
        if self.S['cam_cnt'] >= self.T['OFFSET_FRAMES']:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_wrong:
            self.S['cam_cnt'] = 0

        # ── Check minimum landmark visibility ────────────────────
        side = 'l' if left else 'r'
        if V(f'{side}_el') < 0.45 or V(f'{side}_wr') < 0.45:
            self._draw_hud(frame, fw, None, 180)
            lbl(frame, 'LOW VISIBILITY — MOVE INTO FRAME',
                30, fh - 55, scale=0.55, bg=(80, 80, 20))
            return frame

        # ── Key angles ────────────────────────────────────────────
        #
        #  1. ELBOW JOINT ANGLE  — primary rep metric
        #     joint_angle(sh, el, wr): angle at elbow, 55–180°
        #     55–87°  = AT CHEST (s3)
        #     88–157° = MOVING   (s2)
        #     158–180°= LOCKOUT  (s1)
        #
        elbow_a = joint_angle(sh, el, wr)

        #  2. UPPER ARM VERTICAL ANGLE — bar path quality
        #     vert_angle(sh, el): how far upper arm deviates from vertical
        #     (press direction = vertical in image for side-view lying down)
        #     0–20° = ideal, >30° = drifting
        #
        arm_v = vert_angle(sh, el)

        #  3. SIGNED BAR DIRECTION (forward = toward face)
        #     head_dir: +1 if nose is to the right of shoulder in image
        head_dir = 1 if int(nose[0]) > int(sh[0]) else -1
        el_signed = signed_elbow_fwd(el, sh, head_dir)   # px; + = toward face

        #  4. WRIST STACK  — wrist over elbow in the press axis
        #     |wr.x – el.x| / fw  (smaller = better stacking)
        #
        wrist_off = abs(int(wr[0]) - int(el[0])) / fw

        # ── State machine ─────────────────────────────────────────
        state = self._state(elbow_a)
        self._update_seq(state)

        # ── Form checks ───────────────────────────────────────────
        #  FB[0]: elbows drifting toward face (el_signed > 0 AND arm_v high)
        #  FB[1]: elbows too far back toward belly (el_signed < 0 AND arm_v high)
        #  FB[2]: wrist not stacked over elbow
        #  FB[3]: bar too shallow (never reached s3) — shown mid-ascent
        #  FB[4]: no lockout — shown when rep should be completing
        bad = np.zeros(5, bool)

        T = self.T

        # Check during active pressing phases only
        if state in ('s2', 's3'):
            # Bar path forward (toward face)
            if arm_v > T['ARM_DEV_THRESH'] and el_signed > 0:
                bad[0] = True
            # Bar path backward (toward belly)
            if arm_v > T['ARM_DEV_THRESH'] and el_signed < 0:
                bad[1] = True
            # Wrist not stacked
            if wrist_off > T['WRIST_STACK_THRESH']:
                bad[2] = True

        # Shallow rep warning: in ascent (s3 was hit, now s2) but bar very high
        in_ascent    = ('s3' in self.S['seq'] and self.S['seq'].count('s2') == 2)
        in_descent   = ('s2' in self.S['seq'] and 's3' not in self.S['seq'])

        # Encourage reaching chest during descent
        if in_descent and state == 's2' and elbow_a < self.T['STATES']['s2'][0] + 20:
            bad[3] = True   # "lower bar to chest" nudge

        # Encourage lockout during ascent
        if in_ascent and state == 's2' and elbow_a < self.T['STATES']['s1'][0] - 10:
            bad[4] = True   # "lock out" nudge

        # Mark rep as bad if primary form errors occur
        if bad[0] or bad[1] or bad[2]:
            self.S['bad_form'] = True

        # Debounce feedback (only show after N consecutive frames)
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= T['FB_FRAMES']

        # ── Voice: highest-priority form error ────────────────────
        for i in range(5):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── Voice: phase coaching ─────────────────────────────────
        self._coach_phase(state, elbow_a)

        # ── Rep counting ──────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and not self.S['bad_form']:
                # Full good rep: ['s2', 's3', 's2'] → back to s1
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Bench Press #{n} — correct")
            elif 's3' not in seq and len(seq) >= 1:
                # Never reached chest
                self.S['incorrect'] += 1
                self.S['fb_cnt'][3]  = T['FB_FRAMES'] + 1
                self.S['fb_show'][3] = True
                self.voice.say('too_shallow')
                print(f"❌  Too shallow — bar never reached chest")
            elif self.S['bad_form']:
                # Reached chest but form was broken
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")
            # Reset per-rep state
            self.S['seq']       = []
            self.S['bad_form']  = False
            self.S['depth_said'] = False

        self.S['prev_state'] = state

        # ── Inactivity auto-reset ─────────────────────────────────
        now = time.perf_counter()
        if state == self.S['last_state_for_inact']:
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']              = 0.0
            self.S['last_state_for_inact']  = state
        self.S['last_t'] = now

        # ── Draw ──────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr)
        self._draw_angles(frame, sh, el, wr, hip, elbow_a, arm_v, wrist_off)
        self._draw_hud(frame, fw, state, elbow_a)
        self._draw_feedback(frame)

        # Debug readout at very bottom
        cv2.putText(
            frame,
            f'ELBOW:{elbow_a}°  ARM_V:{arm_v}°  '
            f'WRIST_OFF:{wrist_off*100:.0f}%  '
            f'EL_FWD:{el_signed/fw*100:.0f}%  STATE:{state}',
            (10, fh - 12), FONT, 0.36, (110, 110, 110), 1, AA,
        )

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ──────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ──────────────────────────────────────────────────────────────────

    def _state(self, elbow_a: int) -> str:
        """Map elbow angle to phase state: s1 (lockout), s2 (moving), s3 (chest)."""
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= elbow_a <= hi:
                return name
        # Fallback: angle out of all ranges
        if elbow_a >= self.T['STATES']['s1'][0]:
            return 's1'
        if elbow_a >= self.T['STATES']['s2'][0]:
            return 's2'
        return 's3'

    def _update_seq(self, state: str):
        """
        Build the rep sequence.
        A complete press is:  s1 → [s2, s3, s2] → s1
        (lockout → descent → chest → ascent → lockout)
        """
        seq = self.S['seq']
        if state == 's2':
            # First s2 during descent (before s3), or second s2 during ascent (after s3)
            if ('s3' not in seq and seq.count('s2') == 0) or \
               ('s3' in seq     and seq.count('s2') == 1):
                seq.append(state)
        elif state == 's3':
            # Only add s3 once, and only after first s2
            if 's3' not in seq and 's2' in seq:
                seq.append(state)

    # ──────────────────────────────────────────────────────────────────
    #  VOICE PHASE COACHING
    # ──────────────────────────────────────────────────────────────────

    def _coach_phase(self, state: str, elbow_a: int):
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Entering mid-descent for the first time
            self.voice.say('going_down')

        elif state == 's3':
            # Bar reached chest
            if not self.S['depth_said']:
                self.S['depth_said'] = True
                self.voice.say('at_chest')

        elif state == 's2' and 's3' in self.S['seq']:
            # Coming back up (ascending)
            self.voice.say('coming_up')

        elif state == 's1' and self.S['prev_state'] == 's2':
            # Returned to lockout
            self.voice.say('at_top')

    # ──────────────────────────────────────────────────────────────────
    #  DRAWING
    # ──────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr):
        """Draw upper-arm and forearm bones with joint markers."""
        cv2.line(frame, tuple(sh), tuple(el), C['lt_blue'], 4, AA)   # upper arm
        cv2.line(frame, tuple(el), tuple(wr), C['lt_blue'], 4, AA)   # forearm
        for pt in (sh, el, wr):
            cv2.circle(frame, tuple(pt), 7, C['yellow'], -1, AA)

    def _draw_angles(self, frame, sh, el, wr, hip,
                     elbow_a: int, arm_v: int, wrist_off: float):
        """
        Draw reference lines, angle arcs and value labels.

        Reference lines:
          • Vertical dotted line at sh.x (ideal press path straight up)
          • Vertical dotted line at el.x (shows where wrist should be)

        Arcs:
          • Elbow arc  (sh → el → wr)  — primary rep angle
          • Upper arm arc at shoulder  — deviation from vertical
        """
        T = self.T

        # ── vertical reference lines ──────────────────────────────
        dotted_v(frame, sh, sh[1] - 90, sh[1] + 20, C['blue'])
        dotted_v(frame, el, el[1] - 60, el[1] + 40, C['blue'])

        # ── color logic ───────────────────────────────────────────
        # Elbow angle color
        s3_lo, s3_hi = T['STATES']['s3']
        s1_lo        = T['STATES']['s1'][0]
        if elbow_a >= s1_lo:
            el_col = C['green']   # lockout — good
        elif elbow_a >= s3_lo:
            el_col = C['yellow']  # moving — neutral
        else:
            el_col = C['red']     # below s3 range (hyper-deep)

        # Upper arm deviation color
        arm_col = (C['red']    if arm_v > T['ARM_DEV_THRESH'] + 5
                   else C['orange'] if arm_v > T['ARM_DEV_THRESH']
                   else C['green'])

        # Wrist stack color
        ws_col = (C['red']    if wrist_off > T['WRIST_STACK_THRESH'] + 0.04
                  else C['orange'] if wrist_off > T['WRIST_STACK_THRESH']
                  else C['green'])

        # ── elbow angle arc (at elbow joint) ─────────────────────
        angle_arc(frame, el, sh, wr, el_col, r=30)

        # ── upper-arm vertical reference arc (at shoulder) ────────
        # Draw tiny arc showing deviation from vertical at shoulder
        vert_ref = sh - np.array([0, 55])   # point straight up from shoulder
        angle_arc(frame, sh, vert_ref, el, arm_col, r=22)

        # ── angle text labels ─────────────────────────────────────
        # Elbow angle near elbow
        cv2.putText(frame, f'{elbow_a}\u00b0',
                    (el[0] + 12, el[1]),
                    FONT, 0.58, el_col, 2, AA)

        # Upper arm deviation near shoulder
        cv2.putText(frame, f'ARM_V {arm_v}\u00b0',
                    (sh[0] + 14, sh[1] - 40),
                    FONT, 0.50, arm_col, 2, AA)

        # Wrist stack near wrist
        cv2.putText(frame, f'WRIST {wrist_off*100:.0f}%',
                    (wr[0] + 12, wr[1]),
                    FONT, 0.50, ws_col, 2, AA)

        # ── color body segments by quality ───────────────────────
        el_line_col = C['red'] if arm_v > T['ARM_DEV_THRESH'] else C['green']
        wr_line_col = C['red'] if wrist_off > T['WRIST_STACK_THRESH'] else C['green']
        cv2.line(frame, tuple(sh), tuple(el), el_line_col, 3, AA)
        cv2.line(frame, tuple(el), tuple(wr), wr_line_col, 3, AA)

    def _draw_hud(self, frame, fw: int, state, elbow_a: int):
        """Top-left rep counter + phase badge + ROM progress bar."""
        # Phase label and color
        phase_map = {
            's1': ('LOCKOUT',  (0, 130,  0)),
            's2': ('MOVING',   (0, 130, 180)),
            's3': ('AT CHEST', (0,  60, 200)),
        }
        phase_txt, p_col = phase_map.get(state, ('---', C['dark']))

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)
        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw * 0.68), 84, bg=(180, 20, 20))

        # ── ROM progress bar ──────────────────────────────────────
        # Fills from 0% (lockout=180°) to 100% (chest=s3_lo)
        s3_lo = self.T['STATES']['s3'][0]
        s1_hi = self.T['STATES']['s1'][1]
        pct   = min(max(s1_hi - elbow_a, 0) / max(s1_hi - s3_lo, 1), 1.0)

        bx, by, bw, bh = 30, 55, 180, 8
        cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (30, 30, 30), -1)
        fill = int(pct * bw)
        if fill > 0:
            col = (0, 200, 80) if pct < 1.0 else (0, 255, 180)
            cv2.rectangle(frame, (bx, by), (bx + fill, by + bh), col, -1)
        cv2.putText(frame, 'ROM', (bx, by + bh + 14),
                    FONT, 0.38, (100, 100, 100), 1, AA)

        if self.S['bad_form']:
            lbl(frame, 'FORM ERROR THIS REP', 30, 88,
                scale=0.50, bg=(180, 20, 20))

    def _draw_feedback(self, frame):
        """Render active feedback banners."""
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                lbl(frame, text, 30, y, scale=0.58,
                    fg=C['white'], bg=bg, pad=10)

    # ──────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ──────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        """Overlay when camera orientation is wrong."""
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']),
                        (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 180)
        lbl(frame, 'LIE ON BENCH — CAMERA MUST BE AT YOUR SIDE',
            30, fh - 55, scale=0.55, bg=(180, 80, 20), pad=10)
        self.voice.say('camera')
        if self.flip:
            frame = cv2.flip(frame, 1)

    def _no_person(self, frame, fw):
        """Handle frames with no detected pose."""
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
        model_complexity=1,       # 0=fast, 1=balanced, 2=most accurate
        smooth_landmarks=True,
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(
        description='AI Barbell Bench Press Analyzer — side-view pose correction'
    )
    ap.add_argument('--video',  default=None,
                    help='Path to video file; omit for webcam')
    ap.add_argument('--mode',   default='beginner',
                    choices=['beginner', 'pro'],
                    help='beginner = more tolerant thresholds  |  '
                         'pro = stricter angles (default: beginner)')
    ap.add_argument('--flip',   action='store_true',
                    help='Mirror the frame horizontally')
    ap.add_argument('--mute',   action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',  type=int, default=5,
                    help='Voice speed 1-10 (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = BenchPressProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()

    src = 0 if args.video is None else args.video
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print()
    print(f"🏋  Barbell Bench Press Analyzer  [{args.mode.upper()}]")
    print("━" * 58)
    print("    Camera : SIDE VIEW at bench height, perpendicular to body")
    print("    Angles : Elbow joint angle  ·  Upper arm vertical angle")
    print("             Wrist stack offset")
    print()
    print("    Elbow angle targets:")
    lo, hi = T['STATES']['s1']
    print(f"      LOCKOUT   : {lo}–{hi}°")
    lo, hi = T['STATES']['s2']
    print(f"      MOVING    : {lo}–{hi}°")
    lo, hi = T['STATES']['s3']
    print(f"      AT CHEST  : {lo}–{hi}°")
    print()
    print("    Press  Q  to quit")
    print("━" * 58)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Bench Press Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        print()
        print("── Final Results ─────────────────────────────────────")
        print(f"  ✅  Correct   reps : {proc.S['correct']}")
        print(f"  ❌  Incorrect reps : {proc.S['incorrect']}")
        print("──────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()