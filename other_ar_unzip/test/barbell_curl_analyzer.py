"""
AI Fitness Trainer - Barbell Curl Analyzer  (v1)
=================================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python barbell_curl_analyzer.py
    python barbell_curl_analyzer.py --mode pro
    python barbell_curl_analyzer.py --flip --mute
    python barbell_curl_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at waist/hip height. Full upper body (hip → wrist) visible in profile.

╔══════════════════════════════════════════════════════════════════════╗
║  ACCURATE ANGLES TRACKED  (sports-science / biomechanics)            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  1. ELBOW JOINT ANGLE  (shoulder → elbow → wrist)                    ║
║     PRIMARY rep metric — measures range of motion.                   ║
║     EXTENDED  (bottom) : 155–180°  full arm hang, bar at hips        ║
║     MOVING             :  50–154°  mid curl up or down               ║
║     CONTRACTED (top)   :  30–49°   full bicep contraction             ║
║                                                                      ║
║  2. ELBOW SWING ANGLE  vert_angle(shoulder → elbow)                  ║
║     How far the elbow drifts FORWARD from the body.                  ║
║     Ideal     :  0–15°   elbow pinned tight to the torso             ║
║     Warning   : 16–24°   slight drift                                ║
║     CHEAT     :  ≥25°   elbow swinging forward (shoulder doing work) ║
║                                                                      ║
║  3. TORSO SWAY ANGLE   vert_angle(shoulder → hip)                    ║
║     Detects leaning back for momentum (the classic barbell curl cheat)║
║     Ideal     :  0–10°   upright, neutral spine                      ║
║     Warning   : 11–18°   slight sway                                 ║
║     CHEAT     :  ≥19°   body rocking backward to heave the bar       ║
║                                                                      ║
║  4. WRIST BREAK         vert_angle(elbow → wrist) vs upper arm       ║
║     Wrist should stay neutral — not hyperextending backward.         ║
║     Delta between forearm angle and upper arm angle:                 ║
║     Ideal     :  0–20°  wrist in line with forearm                   ║
║     Warning   : >25°    wrist breaking / hyperextending              ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

What it detects:
  • Rep counting  (correct vs incorrect)
  • Elbow swinging forward  (using front deltoid / cheating)
  • Body rocking backward   (using momentum / lower back risk)
  • Wrist hyperextension    (injury risk)
  • Incomplete extension    (bar never fully lowered)
  • Incomplete contraction  (bar never reached full curl)

Voice coaches every phase:
  Curl up → peak contraction → lower → full extension → rep count → form errors
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
#  Identical PowerShell SpeakAsync engine — mirrors squat_analyzer2.py
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ──────────────────────────────────────────
        'camera'         : "Stand sideways to the camera. Full body in frame.",
        'reset'          : "Counters reset.",
        # ── phase coaching ──────────────────────────────────────────
        'curling_up'     : "Curling up. Drive your elbows back.",
        'at_top'         : "Peak contraction! Squeeze the bicep.",
        'lowering'       : "Control the negative. Lower slowly.",
        'at_bottom'      : "Full extension. Don't let it drop.",
        # ── rep results ─────────────────────────────────────────────
        'good_rep'       : "Good curl!",
        'no_contraction' : "Not full range. Curl higher next time.",
        'bad_form_rep'   : "Rep not counted. Fix your form.",
        # ── form errors (spoken immediately) ────────────────────────
        'elbow_swing'    : "Elbows swinging forward! Pin them to your sides.",
        'body_sway'      : "Stop rocking! Stand tall, use only your arms.",
        'wrist_break'    : "Wrists bending back! Keep them neutral.",
        'no_extension'   : "Fully extend at the bottom for complete range.",
        'curl_higher'    : "Curl higher to fully contract the bicep.",
        # ── rep count milestones ────────────────────────────────────
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
        'curling_up'    : 2.5,
        'at_top'        : 2.0,
        'lowering'      : 2.0,
        'at_bottom'     : 2.5,
        'good_rep'      : 1.5,
        'no_contraction': 3.0,
        'bad_form_rep'  : 3.0,
        'elbow_swing'   : 4.0,
        'body_sway'     : 4.0,
        'wrist_break'   : 4.0,
        'no_extension'  : 3.0,
        'curl_higher'   : 3.0,
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
        """Speak with per-key cooldown. Clears stale queued phrases."""
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
    Barbell Curl angle definitions
    ───────────────────────────────────────────────────────────────────
    elbow_angle  = joint angle at elbow (shoulder → elbow → wrist)
                   Range: 0–180°.  Large = extended.  Small = contracted.

      s1  EXTENDED    : 155–180°  bar at hips, arms fully hanging
      s2  MOVING      :  50–154°  mid-rep (curl or lower)
      s3  CONTRACTED  :  30–49°   full bicep contraction at the top

    elbow_swing  = vert_angle(shoulder → elbow)
                   How far the upper arm deviates from the vertical axis.
                   0° = elbow pinned straight down.
                   Rises as elbow swings FORWARD (shoulder cheat).

    body_sway    = vert_angle(shoulder → hip)
                   0° = upright torso.
                   Rises as person leans backward (momentum cheat).
                   Measured with sign: positive = leaning back.

    wrist_break  = |vert_angle(elbow → wrist) − vert_angle(shoulder → elbow)|
                   Difference between forearm and upper-arm angles.
                   0° = wrist neutral/in line.
                   Large = wrist hyperextending backward under the bar.
    """
    if mode == 'pro':
        return {
            'STATES': {
                's1': (158, 180),   # EXTENDED (bottom)
                's2': ( 50, 157),   # MOVING
                's3': ( 25,  49),   # CONTRACTED (top)
            },
            # Upper arm must stay within this many degrees of vertical
            'ELBOW_SWING_WARN'  :  16,   # orange warning
            'ELBOW_SWING_BAD'   :  22,   # red error + voice
            # Torso sway from vertical
            'BODY_SWAY_WARN'    :  10,
            'BODY_SWAY_BAD'     :  16,
            # Wrist break delta
            'WRIST_BREAK_WARN'  :  18,
            'WRIST_BREAK_BAD'   :  24,
            # Camera: shoulder-offset angle for side-view check
            'OFFSET_THRESH'     :  35.0,
            'OFFSET_FRAMES'     :  15,
            # Inactivity
            'INACTIVE_THRESH'   :  15.0,
            # Feedback debounce (consecutive frames before showing)
            'FB_FRAMES'         :   5,
        }
    else:   # beginner
        return {
            'STATES': {
                's1': (155, 180),
                's2': ( 50, 154),
                's3': ( 30,  49),
            },
            'ELBOW_SWING_WARN'  :  20,
            'ELBOW_SWING_BAD'   :  28,
            'BODY_SWAY_WARN'    :  13,
            'BODY_SWAY_BAD'     :  20,
            'WRIST_BREAK_WARN'  :  22,
            'WRIST_BREAK_BAD'   :  30,
            'OFFSET_THRESH'     :  35.0,
            'OFFSET_FRAMES'     :  15,
            'INACTIVE_THRESH'   :  15.0,
            'FB_FRAMES'         :   5,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
#  Identical helper functions to squat_analyzer2.py
# ══════════════════════════════════════════════════════════════════════

def vert_angle(p_top, p_bot) -> int:
    """
    Angle (degrees) of the segment p_top→p_bot from the image vertical axis.
    0° = segment points straight down.   90° = segment is horizontal.
    """
    dx = int(p_bot[0]) - int(p_top[0])
    dy = int(p_bot[1]) - int(p_top[1])
    return int(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-9)))


def joint_angle(p1, p2, p3) -> int:
    """Standard joint angle at vertex p2 between rays p2→p1 and p2→p3.
       Returns degrees in range [0, 180]."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def signed_sway(sh, hip) -> int:
    """
    Signed horizontal offset of hip relative to shoulder.
    Positive = hip is BEHIND shoulder = leaning backward (momentum cheat).
    Negative = hip is AHEAD of shoulder = leaning forward.
    Measured in image x, adjusted for side facing direction.
    """
    return int(hip[0]) - int(sh[0])


def nose_shoulder_angle(nose, l_sh, r_sh) -> int:
    """Camera alignment angle — same as squat analyzer."""
    mid = ((l_sh + r_sh) / 2).astype(float)
    v1  = (l_sh  - mid).astype(float)
    v2  = (nose  - mid).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def px(lm, idx, fw, fh) -> np.ndarray:
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


# ══════════════════════════════════════════════════════════════════════
#  DRAWING HELPERS  (identical to squat_analyzer2.py)
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
    """Filled rounded rectangle."""
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r), color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),   color, -1)
    cv2.rectangle(img, (x1,   y1+r), (x1+r, y2-r), color, -1)
    cv2.rectangle(img, (x2-r, y1+r), (x2,   y2-r), color, -1)
    cv2.rectangle(img, (x1+r, y1+r), (x2-r, y2-r), color, -1)
    for cx, cy, sa, ea in [(x1+r, y1+r, 180, 270), (x2-r, y1+r, 270, 360),
                            (x1+r, y2-r,  90, 180), (x2-r, y2-r,   0,  90)]:
        cv2.ellipse(img, (cx, cy), (r, r), 0, sa, ea, color, -1)


def lbl(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    """Rounded-rectangle badge label."""
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_v(img, pt, y0, y1, color, gap=8):
    """Dotted vertical guide line at pt.x."""
    for y in range(min(y0, y1), max(y0, y1), gap):
        cv2.circle(img, (int(pt[0]), y), 2, color, -1, AA)


def angle_arc(img, vertex, p1, p2, color, r=26):
    """Draw arc at vertex showing angle between directions to p1 and p2."""
    v1 = (p1 - vertex).astype(float)
    v2 = (p2 - vertex).astype(float)
    sa = int(np.degrees(np.arctan2(v1[1], v1[0])))
    ea = int(np.degrees(np.arctan2(v2[1], v2[0])))
    cv2.ellipse(img, tuple(vertex.astype(int)), (r, r), 0, sa, ea, color, 2, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (display_label, y_pos, bg_color, voice_key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('ELBOWS SWINGING FORWARD — PIN TO SIDES',  125, (0,   80, 210), 'elbow_swing'),
    1: ('BODY ROCKING BACK — STAND TALL, NO SWAY', 175, (0,   80, 210), 'body_sway'),
    2: ('WRISTS BENDING BACK — KEEP THEM NEUTRAL', 225, (180,  40,  40), 'wrist_break'),
    3: ('CURL HIGHER — FULL BICEP CONTRACTION',    275, (20,  130,  20), 'curl_higher'),
    4: ('EXTEND FULLY — LOWER BAR ALL THE WAY',    325, (180,  40,  40), 'no_extension'),
}


# ══════════════════════════════════════════════════════════════════════
#  LANDMARK INDICES  (MediaPipe Pose)
# ══════════════════════════════════════════════════════════════════════

LM = dict(
    nose=0,
    l_sh=11, r_sh=12,
    l_el=13, r_el=14,
    l_wr=15, r_wr=16,
    l_hip=23, r_hip=24,
)


# ══════════════════════════════════════════════════════════════════════
#  BARBELL CURL PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class BarbellCurlProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            # ── rep state machine ────────────────────────────────
            seq          = [],          # e.g. ['s2','s3','s2'] for a complete curl
            prev_state   = None,
            bad_form     = False,

            # ── counters ─────────────────────────────────────────
            correct      = 0,
            incorrect    = 0,

            # ── feedback debounce ─────────────────────────────────
            fb_cnt       = np.zeros(5, int),
            fb_show      = np.zeros(5, bool),

            # ── voice phase ───────────────────────────────────────
            last_phase   = None,
            peak_said    = False,       # "squeeze" cue given this rep

            # ── camera orientation ───────────────────────────────
            cam_cnt      = 0,

            # ── inactivity auto-reset ────────────────────────────
            inactive     = 0.0,
            last_t       = time.perf_counter(),
            last_state_for_inact = None,
        )

    # ─────────────────────────────────────────────────────────────────
    #  MAIN PROCESS  (called every frame)
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

        # ── Landmarks ────────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');  r_sh  = G('r_sh')
        l_el  = G('l_el');  r_el  = G('r_el')
        l_wr  = G('l_wr');  r_wr  = G('r_wr')
        l_hip = G('l_hip'); r_hip = G('r_hip')

        # ── Camera alignment check (mirrors squat analyzer) ───────
        off_ang  = nose_shoulder_angle(nose, l_sh, r_sh)
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

        # ── Pick more-visible side ────────────────────────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh, el, wr, hip = l_sh, l_el, l_wr, l_hip
        else:
            sh, el, wr, hip = r_sh, r_el, r_wr, r_hip

        # ── Minimum visibility gate ───────────────────────────────
        side = 'l' if left else 'r'
        if V(f'{side}_el') < 0.40 or V(f'{side}_wr') < 0.40:
            self._draw_hud(frame, fw, None, 180)
            lbl(frame, 'LOW VISIBILITY — STEP BACK INTO FRAME',
                30, fh - 55, scale=0.55, bg=(80, 80, 20))
            return frame

        # ══════════════════════════════════════════════════════════
        #  CALCULATE ALL 4 ANGLES
        # ══════════════════════════════════════════════════════════

        # ── 1. ELBOW JOINT ANGLE — primary rep metric ─────────────
        #   joint_angle(shoulder, elbow, wrist)
        #   180° = arms fully hanging down (bar at hips)
        #   ~35° = full bicep contraction (bar near chin level)
        elbow_a = joint_angle(sh, el, wr)

        # ── 2. ELBOW SWING ANGLE — cheat detection ────────────────
        #   vert_angle(shoulder → elbow)
        #   In a strict curl the upper arm hangs VERTICALLY (0°).
        #   As the elbow swings forward this angle increases.
        #   Computed from the shoulder downward, so we use (el, sh) because
        #   the upper arm runs shoulder→elbow and should point straight DOWN
        #   at the start (shoulder is ABOVE elbow in y).
        elbow_swing = vert_angle(sh, el)

        # ── 3. TORSO SWAY ANGLE — momentum cheat ─────────────────
        #   vert_angle(shoulder → hip)
        #   0° = perfectly upright.  Increases when person leans backward.
        #   We also get the signed direction to distinguish lean-back vs lean-fwd.
        torso_v    = vert_angle(sh, hip)
        sway_sign  = signed_sway(sh, hip)   # >0 = hip behind shoulder = lean back

        # ── 4. WRIST BREAK — injury risk ─────────────────────────
        #   Compare vert_angle(elbow→wrist) vs vert_angle(shoulder→elbow).
        #   A neutral wrist means the forearm and upper arm share the same
        #   vertical-axis angle.  Large delta = wrist hyperextending.
        upper_arm_v = vert_angle(sh,  el)
        forearm_v   = vert_angle(el, wr)
        wrist_delta = abs(forearm_v - upper_arm_v)

        # ══════════════════════════════════════════════════════════
        #  STATE MACHINE
        # ══════════════════════════════════════════════════════════

        state = self._state(elbow_a)
        self._update_seq(state)

        # ══════════════════════════════════════════════════════════
        #  FORM CHECKS  → bad[0..4]
        # ══════════════════════════════════════════════════════════
        T   = self.T
        bad = np.zeros(5, bool)

        # [0] Elbow swinging forward (active during the curl motion only)
        if state in ('s2', 's3') and elbow_swing > T['ELBOW_SWING_BAD']:
            bad[0] = True

        # [1] Body sway backward (sway_sign depends on which side faces camera)
        #     We use absolute torso_v > threshold because we detect side-view
        if torso_v > T['BODY_SWAY_BAD']:
            bad[1] = True

        # [2] Wrist hyperextension (relevant at mid-range and peak)
        if state in ('s2', 's3') and wrist_delta > T['WRIST_BREAK_BAD']:
            bad[2] = True

        # [3] Not curling high enough — nudge during ascending phase
        in_ascent = ('s2' in self.S['seq'] and 's3' not in self.S['seq'])
        if in_ascent and state == 's2' and elbow_a < T['STATES']['s2'][0] + 25:
            bad[3] = True   # "curl higher" nudge

        # [4] Not extending fully — nudge during descending phase
        in_descent = ('s3' in self.S['seq'] and self.S['seq'].count('s2') == 2)
        if in_descent and state == 's2' and elbow_a > T['STATES']['s1'][0] - 20:
            bad[4] = True   # "extend fully" nudge

        # Mark rep bad if primary errors occurred
        if bad[0] or bad[1] or bad[2]:
            self.S['bad_form'] = True

        # Debounce: only show feedback after N consecutive flagged frames
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

        # ══════════════════════════════════════════════════════════
        #  REP COUNTING
        #  Complete curl: s1 → s2 → s3 → s2 → s1
        #  seq must be exactly ['s2', 's3', 's2']
        # ══════════════════════════════════════════════════════════

        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and seq == ['s2', 's3', 's2'] and not self.S['bad_form']:
                # ✅ Perfect full-range rep
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Barbell Curl #{n} — correct")

            elif 's3' not in seq and len(seq) >= 1:
                # Bar never reached contracted position
                self.S['incorrect'] += 1
                self.S['fb_cnt'][3]  = T['FB_FRAMES'] + 1
                self.S['fb_show'][3] = True
                self.voice.say('no_contraction')
                print(f"❌  Incomplete curl — bar never fully contracted")

            elif self.S['bad_form']:
                # Reached s3 but form was broken
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")

            # Reset per-rep trackers
            self.S['seq']       = []
            self.S['bad_form']  = False
            self.S['peak_said'] = False

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

        # ── Draw everything ───────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip)
        self._draw_angles(frame, sh, el, wr, hip,
                          elbow_a, elbow_swing, torso_v, wrist_delta)
        self._draw_hud(frame, fw, state, elbow_a)
        self._draw_feedback(frame)

        # Debug readout at very bottom
        cv2.putText(
            frame,
            (f'ELBOW:{elbow_a}°  SWING:{elbow_swing}°  '
             f'SWAY:{torso_v}°({"back" if sway_sign > 0 else "fwd"})  '
             f'WRIST_Δ:{wrist_delta}°  STATE:{state}'),
            (10, fh - 12), FONT, 0.36, (110, 110, 110), 1, AA,
        )

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, elbow_a: int) -> str:
        """Map elbow angle → rep phase.
           s1 = EXTENDED (bottom)
           s2 = MOVING (mid-range)
           s3 = CONTRACTED (peak top)
        """
        for name, (lo, hi) in self.T['STATES'].items():
            if lo <= elbow_a <= hi:
                return name
        # Clamp out-of-range
        if elbow_a >= self.T['STATES']['s1'][0]:
            return 's1'
        if elbow_a >= self.T['STATES']['s2'][0]:
            return 's2'
        return 's3'

    def _update_seq(self, state: str):
        """
        Build the 3-element rep sequence.
        Complete curl: s1 → [s2, s3, s2] → s1

        Append rules:
          s2 — append if it's the first s2 (ascending) OR the second s2 (descending)
          s3 — append only once, only after the first s2
        """
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

    def _coach_phase(self, state: str, elbow_a: int):
        """Speak contextual coaching cues as the phase changes."""
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Starting the curl upward
            self.voice.say('curling_up')

        elif state == 's3':
            # Reached full contraction
            if not self.S['peak_said']:
                self.S['peak_said'] = True
                self.voice.say('at_top')

        elif state == 's2' and 's3' in self.S['seq']:
            # On the way back down
            self.voice.say('lowering')

        elif state == 's1' and self.S['prev_state'] == 's2':
            # Full extension reached
            self.voice.say('at_bottom')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip):
        """Draw bones and joint markers for upper body."""
        bones = [(sh, el), (el, wr), (sh, hip)]
        for a, b in bones:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 4, AA)
        for pt in (sh, el, wr, hip):
            cv2.circle(frame, tuple(pt), 7, C['yellow'], -1, AA)

    def _draw_angles(self, frame, sh, el, wr, hip,
                     elbow_a: int, elbow_swing: int,
                     torso_v: int, wrist_delta: int):
        """
        Visual angle overlays — three vertical reference lines and arcs.

        References:
          • Dotted vertical at sh.x  — ideal upper-arm axis
          • Dotted vertical at el.x  — ideal forearm drop axis
          • Dotted vertical at hip.x — torso plumb line

        Colored arcs:
          • Elbow joint arc   (sh→el→wr)  — ROM angle
          • Elbow swing arc   (vertical ref → upper arm)
          • Torso sway arc    (vertical ref → shoulder→hip)
        """
        T = self.T

        # ── vertical dotted reference lines ──────────────────────
        dotted_v(frame, sh,  sh[1]  - 80,  sh[1]  + 30, C['blue'])
        dotted_v(frame, el,  el[1]  - 60,  el[1]  + 40, C['blue'])
        dotted_v(frame, hip, hip[1] - 100, hip[1] + 20, C['blue'])

        # ── elbow joint angle color ───────────────────────────────
        s3_lo = T['STATES']['s3'][0]
        s1_lo = T['STATES']['s1'][0]
        if elbow_a >= s1_lo:
            el_col = C['cyan']    # fully extended — starting position
        elif elbow_a <= s3_lo + 5:
            el_col = C['green']   # fully contracted — great
        else:
            el_col = C['yellow']  # moving — neutral

        # ── elbow swing color ─────────────────────────────────────
        sw_col = (C['red']    if elbow_swing > T['ELBOW_SWING_BAD']
                  else C['orange'] if elbow_swing > T['ELBOW_SWING_WARN']
                  else C['green'])

        # ── torso sway color ──────────────────────────────────────
        ts_col = (C['red']    if torso_v > T['BODY_SWAY_BAD']
                  else C['orange'] if torso_v > T['BODY_SWAY_WARN']
                  else C['green'])

        # ── wrist delta color ─────────────────────────────────────
        wr_col = (C['red']    if wrist_delta > T['WRIST_BREAK_BAD']
                  else C['orange'] if wrist_delta > T['WRIST_BREAK_WARN']
                  else C['green'])

        # ── elbow joint arc (at elbow) ────────────────────────────
        angle_arc(frame, el, sh, wr, el_col, r=30)

        # ── elbow swing arc (at shoulder: vertical ref vs upper arm) ─
        vert_ref_sh = sh - np.array([0, 55])
        angle_arc(frame, sh, vert_ref_sh, el, sw_col, r=22)

        # ── torso sway arc (at hip: vertical ref vs torso line) ───
        vert_ref_hip = hip - np.array([0, 55])
        angle_arc(frame, hip, vert_ref_hip, sh, ts_col, r=22)

        # ── angle value text ──────────────────────────────────────
        # Elbow angle near elbow joint
        cv2.putText(frame, f'{elbow_a}\u00b0',
                    (el[0] + 14, el[1] + 5),
                    FONT, 0.62, el_col, 2, AA)

        # Elbow swing near shoulder
        cv2.putText(frame, f'SWING {elbow_swing}\u00b0',
                    (sh[0] + 14, sh[1] - 45),
                    FONT, 0.50, sw_col, 2, AA)

        # Torso sway near hip
        cv2.putText(frame, f'SWAY {torso_v}\u00b0',
                    (hip[0] + 14, hip[1] - 15),
                    FONT, 0.50, ts_col, 2, AA)

        # Wrist delta near wrist
        cv2.putText(frame, f'WRIST \u0394{wrist_delta}\u00b0',
                    (wr[0] + 12, wr[1] + 5),
                    FONT, 0.50, wr_col, 2, AA)

        # ── color-code body segments by form quality ──────────────
        # Upper arm: green if swing OK, red if swinging
        ua_col = C['red'] if elbow_swing > T['ELBOW_SWING_BAD'] else C['green']
        # Forearm: green if wrist OK, red if breaking
        fa_col = C['red'] if wrist_delta > T['WRIST_BREAK_BAD'] else C['green']
        # Torso: green if upright, red if swaying
        to_col = C['red'] if torso_v > T['BODY_SWAY_BAD'] else C['green']

        cv2.line(frame, tuple(sh), tuple(el),  ua_col, 3, AA)
        cv2.line(frame, tuple(el), tuple(wr),  fa_col, 3, AA)
        cv2.line(frame, tuple(sh), tuple(hip), to_col, 3, AA)

    def _draw_hud(self, frame, fw: int, state, elbow_a: int):
        """Top HUD: phase badge, rep counters, ROM progress bar."""
        phase_map = {
            's1': ('EXTENDED',   (0,  80,  80)),
            's2': ('MOVING',     (0, 130, 180)),
            's3': ('CONTRACTED', (0,  60, 200)),
        }
        phase_txt, p_col = phase_map.get(state, ('---', C['dark']))

        lbl(frame, f'PHASE: {phase_txt}', 30, 34, bg=p_col)
        lbl(frame, f'CORRECT:   {self.S["correct"]}',
            int(fw * 0.68), 34, bg=(0, 140, 0))
        lbl(frame, f'INCORRECT: {self.S["incorrect"]}',
            int(fw * 0.68), 84, bg=(180, 20, 20))

        # ── ROM progress bar ──────────────────────────────────────
        # 0% = fully extended (s1 = 180°),  100% = fully contracted (s3_lo)
        s3_lo = self.T['STATES']['s3'][0]
        s1_hi = self.T['STATES']['s1'][1]     # 180
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

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        """Overlay when camera orientation / position is wrong."""
        for pt, col in [(nose, C['white']),
                        (l_sh, C['yellow']),
                        (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None, 180)
        lbl(frame, 'STAND SIDEWAYS TO CAMERA',
            30, fh - 55, scale=0.58, bg=(180, 80, 20), pad=10)
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
#  MEDIAPIPE SETUP  (same as squat analyzer)
# ══════════════════════════════════════════════════════════════════════

def make_pose():
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,        # 0=fast  1=balanced  2=most accurate
        smooth_landmarks=True,
        min_detection_confidence=0.55,
        min_tracking_confidence=0.55,
    )


# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(
        description='AI Barbell Curl Analyzer — side-view pose correction coach'
    )
    ap.add_argument('--video',  default=None,
                    help='Path to video file; omit for webcam')
    ap.add_argument('--mode',   default='beginner',
                    choices=['beginner', 'pro'],
                    help='beginner = more forgiving  |  '
                         'pro = strict sports-science angles  (default: beginner)')
    ap.add_argument('--flip',   action='store_true',
                    help='Mirror the frame horizontally')
    ap.add_argument('--mute',   action='store_true',
                    help='Disable voice coaching')
    ap.add_argument('--speed',  type=int, default=5,
                    help='Voice speed 1–10  (default 5)')
    args = ap.parse_args()

    T     = get_thresholds(args.mode)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = BarbellCurlProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()

    src = 0 if args.video is None else args.video
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print()
    print(f"💪  Barbell Curl Analyzer  [{args.mode.upper()}]")
    print("━" * 62)
    print("    Camera  : SIDE VIEW at waist height · full upper body visible")
    print()
    print("    Angles tracked:")
    lo, hi = T['STATES']['s1']
    print(f"      ELBOW — EXTENDED    : {lo}–{hi}°   (arms hanging, bar at hips)")
    lo, hi = T['STATES']['s2']
    print(f"      ELBOW — MOVING      : {lo}–{hi}°   (mid curl)")
    lo, hi = T['STATES']['s3']
    print(f"      ELBOW — CONTRACTED  : {lo}–{hi}°   (peak bicep contraction)")
    print()
    print(f"      ELBOW SWING         : warn >{T['ELBOW_SWING_WARN']}°  "
          f"bad >{T['ELBOW_SWING_BAD']}°   (0° = perfectly pinned)")
    print(f"      BODY SWAY           : warn >{T['BODY_SWAY_WARN']}°  "
          f"bad >{T['BODY_SWAY_BAD']}°   (0° = no rocking)")
    print(f"      WRIST BREAK Δ       : warn >{T['WRIST_BREAK_WARN']}°  "
          f"bad >{T['WRIST_BREAK_BAD']}°   (0° = wrist neutral)")
    print()
    print("    On-screen colours:  🟢 green = good  🟠 orange = warning  🔴 red = error")
    print()
    print("    Press  Q  to quit")
    print("━" * 62)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Barbell Curl Analyzer — Q to quit', output)
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
        print("── Final Results ─────────────────────────────────────────────")
        print(f"  ✅  Correct   reps : {proc.S['correct']}")
        print(f"  ❌  Incorrect reps : {proc.S['incorrect']}")
        print("──────────────────────────────────────────────────────────────")


if __name__ == '__main__':
    main()