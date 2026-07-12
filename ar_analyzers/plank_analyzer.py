"""
AI Fitness Trainer - Plank Analyzer  (v3 — full rewrite)
=========================================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python plank_analyzer.py
    python plank_analyzer.py --mode pro
    python plank_analyzer.py --target 90
    python plank_analyzer.py --flip --mute
    python plank_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at hip/waist height, full body visible.

Detects 5 bad-form errors in real-time:
  1. Hips sagging   (butt dropping — back arches down)
  2. Hips piking    (butt in air   — back arches up)
  3. Neck strained  (head dropped or craned)
  4. Shoulders collapsing forward
  5. Core not activated (body line broken)
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
#  Single persistent PowerShell process using SpeakAsync so new
#  cues INTERRUPT the current phrase instantly — no lag, no overlap.
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── position setup ───────────────────────────────────────────
        'camera'         : "Set up a side view camera.",
        'get_into_plank' : "Get into plank position.",
        'lie_down'       : "Lie down horizontally.",
        'push_up_arms'   : "Push up. Lift your body off the floor.",
        'raise_body'     : "Raise your hips. Straighten your body.",
        'extend_arms'    : "Elbows too bent. Extend your arms.",
        'adjust_arms'    : "Adjust your arm position.",
        'lift_hips_setup': "Hips too low. Lift them up.",
        'lower_hips_setup': "Hips too high. Lower them down.",
        'head_neutral_setup': "Keep your head neutral.",
        # ── in-plank form ────────────────────────────────────────────
        'start'          : "Plank started. Hold it!",
        'sag_hips'       : "Hips sagging! Squeeze your core.",
        'pike_hips'      : "Hips too high! Lower your butt.",
        'neck_drop'      : "Neck strained! Look at the floor.",
        'neck_crane'     : "Don't crane your neck. Look downward.",
        'shoulder_fwd'   : "Shoulders collapsing. Push the floor away.",
        'form_restored'  : "Good. Keep holding.",
        # ── milestones ───────────────────────────────────────────────
        '15'             : "15 seconds. Great start!",
        '30'             : "30 seconds. Keep going!",
        '45'             : "45 seconds. Almost there.",
        '60'             : "60 seconds. Excellent hold!",
        '90'             : "90 seconds. You are on fire!",
        '120'            : "2 minutes. Incredible!",
        'target_hit'     : "Target reached. Amazing plank!",
        'reset'          : "Timer reset.",
    }

    # Seconds between repeating the same cue
    _COOLDOWN = {
        'camera'            : 7.0,
        'get_into_plank'    : 6.0,
        'lie_down'          : 5.0,
        'push_up_arms'      : 5.0,
        'raise_body'        : 5.0,
        'extend_arms'       : 5.0,
        'adjust_arms'       : 5.0,
        'lift_hips_setup'   : 5.0,
        'lower_hips_setup'  : 5.0,
        'head_neutral_setup': 5.0,
        'start'             : 999.0,
        'sag_hips'          : 5.0,
        'pike_hips'         : 5.0,
        'neck_drop'         : 6.0,
        'neck_crane'        : 6.0,
        'shoulder_fwd'      : 6.0,
        'form_restored'     : 4.0,
        'reset'             : 5.0,
    }

    # PowerShell script — stays alive, SpeakAsync lets us cancel mid-phrase
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
        self.mute      = mute
        self._cd       = {}          # last-spoken timestamps
        self._q        = queue.Queue()
        self._proc     = None
        self._thread   = None
        if not mute:
            rate = int((speed - 5) * 2)   # 1→-8, 5→0, 10→+10
            self._launch(rate)

    def say(self, key: str):
        """Speak phrase with cooldown. Interrupts current speech."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 4.0):
            return
        self._cd[key] = now
        # Replace any queued phrase with latest (don't stack up)
        while not self._q.empty():
            try: self._q.get_nowait()
            except queue.Empty: break
        self._q.put(self.PHRASES.get(key, key))

    def say_now(self, key: str):
        """Speak immediately, bypassing cooldown (milestones, one-shots)."""
        if self.mute:
            return
        self._q.put(self.PHRASES.get(key, key))

    def stop(self):
        if self._proc:
            try:
                self._q.put('__EXIT__')
                self._proc.stdin.write('EXIT\n')
                self._proc.stdin.flush()
                self._proc.wait(timeout=2)
            except Exception:
                try: self._proc.terminate()
                except Exception: pass

    def _launch(self, rate):
        script = self._PS.format(rate=rate)
        flags  = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
        try:
            self._proc = subprocess.Popen(
                ['powershell', '-NonInteractive', '-WindowStyle', 'Hidden',
                 '-Command', script],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=flags,
                text=True, encoding='utf-8', bufsize=1,
            )
            self._thread = threading.Thread(target=self._writer, daemon=True)
            self._thread.start()
        except FileNotFoundError:
            print("⚠  PowerShell not found — voice disabled.")
            self.mute = True

    def _writer(self):
        while True:
            try:
                phrase = self._q.get(timeout=0.5)
            except queue.Empty:
                if self._proc and self._proc.poll() is not None:
                    break
                continue
            if phrase == '__EXIT__':
                break
            try:
                self._proc.stdin.write(phrase + '\n')
                self._proc.stdin.flush()
            except (BrokenPipeError, OSError):
                break


# ══════════════════════════════════════════════════════════════════════
#  THRESHOLDS
# ══════════════════════════════════════════════════════════════════════

def get_thresholds(mode='beginner'):
    """
    Hip deviation = SIGNED distance of hip from the ideal shoulder→ankle line.
    Uses TWO complementary checks — both must agree for correct form:

      1. hip_dev (signed deviation from shoulder→ankle line):
           > +SAG_THRESH  → SAGGING  (hip below line, back arches down)
           < -PIKE_THRESH → PIKING   (hip above line, butt in air)

      2. body_angle (shoulder→hip→ankle joint angle):
           < BODY_ANGLE_MIN → body line is broken (either sag or pike)
           Combined with sign of hip_dev to determine which direction.
           This catches SUBTLE sags that hip_dev alone misses.

    Neck angle = ear→shoulder→hip. Good plank: ~150-180°.
    """
    if mode == 'pro':
        return {
            'SAG_THRESH'         : 0.020,  # 2% → sagging
            'PIKE_THRESH'        : 0.015,  # 1.5% → piking
            'BODY_ANGLE_MIN'     : 167,    # body line angle — below = broken
            'NECK_DROP_MIN'      : 150,
            'NECK_CRANE_MAX'     : 183,
            'GRACE_SEC'          : 0.6,
            'FEEDBACK_FRAMES'    : 4,
            'OFFSET_THRESH'      : 55.0,
            'OFFSET_FRAMES'      : 20,
            'INACTIVE_THRESH'    : 8.0,
        }
    else:  # beginner
        return {
            'SAG_THRESH'         : 0.025,  # 2.5% → sagging
            'PIKE_THRESH'        : 0.020,  # 2% → piking
            'BODY_ANGLE_MIN'     : 163,    # body line angle — below = broken
            'NECK_DROP_MIN'      : 140,
            'NECK_CRANE_MAX'     : 185,
            'GRACE_SEC'          : 1.0,
            'FEEDBACK_FRAMES'    : 5,
            'OFFSET_THRESH'      : 55.0,
            'OFFSET_FRAMES'      : 20,
            'INACTIVE_THRESH'    : 8.0,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY HELPERS
# ══════════════════════════════════════════════════════════════════════

def angle_at(p1, p2, p3):
    """Angle (degrees) at vertex p2."""
    v1 = p1 - p2
    v2 = p3 - p2
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def hip_deviation(sh_n, hip_n, ank_n):
    """
    Signed perpendicular deviation of hip from ideal shoulder→ankle line.
    Uses normalized coords. Positive = hip BELOW line (sag). Negative = ABOVE (pike).
    """
    sh_x, sh_y  = sh_n[0],  sh_n[1]
    ak_x, ak_y  = ank_n[0], ank_n[1]
    hp_x, hp_y  = hip_n[0], hip_n[1]

    dx = ak_x - sh_x
    t  = (hp_x - sh_x) / dx if abs(dx) > 0.01 else 0.5
    ideal_y = sh_y + t * (ak_y - sh_y)
    return hp_y - ideal_y   # +ve = below = sag,  -ve = above = pike


def px(lm, idx, fw, fh):
    """Landmark to pixel coord."""
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


def nm(lm, idx):
    """Landmark to normalized [x, y, z]."""
    p = lm[idx]
    return np.array([p.x, p.y, p.z])


# ══════════════════════════════════════════════════════════════════════
#  DRAWING
# ══════════════════════════════════════════════════════════════════════

C = {
    'green'   : (0,   220,  80),
    'red'     : (30,   50, 230),
    'orange'  : (0,   140, 255),
    'blue'    : (255, 140,  0),
    'yellow'  : (0,   230, 230),
    'cyan'    : (230, 200,  0),
    'white'   : (255, 255, 255),
    'magenta' : (200,  0,  200),
    'dark_bg' : (20,   20,  20),
    'mid_bg'  : (40,   40,  80),
}

FONT = cv2.FONT_HERSHEY_SIMPLEX
AA   = cv2.LINE_AA


def rr(img, x1, y1, x2, y2, r, color):
    """Filled rounded rectangle."""
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r),   color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),     color, -1)
    cv2.rectangle(img, (x1,   y1+r), (x1+r, y2-r),   color, -1)
    cv2.rectangle(img, (x2-r, y1+r), (x2,   y2-r),   color, -1)
    cv2.rectangle(img, (x1+r, y1+r), (x2-r, y2-r),   color, -1)
    for cx, cy, sa, ea in [(x1+r,y1+r,180,270),(x2-r,y1+r,270,360),
                           (x1+r,y2-r, 90,180),(x2-r,y2-r,  0, 90)]:
        cv2.ellipse(img, (cx,cy), (r,r), 0, sa, ea, color, -1)


def put_label(img, text, x, y, scale=0.60, fg=C['white'], bg=C['dark_bg'], pad=8):
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_line(img, a, b, color, gap=8):
    a, b = np.array(a, int), np.array(b, int)
    d = int(np.linalg.norm(b - a))
    for i in range(0, d, gap):
        t = i / max(d, 1)
        p = (int(a[0]+t*(b[0]-a[0])), int(a[1]+t*(b[1]-a[1])))
        cv2.circle(img, p, 2, color, -1, AA)


def fmt(s):
    s = int(s)
    return f"{s//60:02d}:{s%60:02d}"


# ══════════════════════════════════════════════════════════════════════
#  MAIN FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

LM = dict(nose=0, l_ear=7, r_ear=8,
          l_sh=11, r_sh=12, l_el=13, r_el=14, l_wr=15, r_wr=16,
          l_hip=23, r_hip=24, l_kn=25, r_kn=26,
          l_ank=27, r_ank=28, l_heel=29, r_heel=30)

# Feedback slots: index → (on-screen label, y, bg-color, voice-key)
FB = {
    0: ('HIPS SAGGING — SQUEEZE YOUR CORE',   170, (20,  60, 200), 'sag_hips'),
    1: ('HIPS TOO HIGH — LOWER YOUR BUTT',    170, (20,  60, 200), 'pike_hips'),
    2: ('NECK STRAINED — LOOK AT FLOOR',      225, (160, 20, 160), 'neck_drop'),
    3: ('NECK CRANING — LOOK DOWNWARD',       225, (160, 20, 160), 'neck_crane'),
    4: ('SHOULDERS COLLAPSING — PUSH UP',     280, (180, 90,  20), 'shoulder_fwd'),
}

MILESTONES = {15:'15', 30:'30', 45:'45', 60:'60', 90:'90', 120:'120'}


class PlankProcessor:

    def __init__(self, thresh, flip=False, voice=None, target=60):
        self.T      = thresh
        self.flip   = flip
        self.voice  = voice or VoiceCoach(mute=True)
        self.target = target

        # state
        self.S = dict(
            hold       = 0.0,          # accumulated good-form time
            best       = 0.0,
            in_plank   = False,
            running    = False,
            form_good  = True,
            grace_start= None,         # when bad form first detected
            tick       = time.perf_counter(),

            # debounce
            plank_cnt  = 0,            # consecutive frames in plank
            out_cnt    = 0,            # consecutive frames out of plank
            fb_cnt     = np.zeros(5, int),   # per-flag frame counter
            fb_show    = np.zeros(5, bool),

            # milestones
            ms_hit     = set(),
            target_done= False,

            # camera
            cam_cnt    = 0,
            inactive   = 0.0,
            last_t     = time.perf_counter(),
        )

    # ─────────────────────────────────────────────────────────────────
    def process(self, frame, pose):
        fh, fw = frame.shape[:2]
        res    = pose.process(frame)

        if not res.pose_landmarks:
            self._no_person(frame, fw, fh)
            return frame

        lm = res.pose_landmarks.landmark
        G  = lambda k: px(lm, LM[k], fw, fh)
        N  = lambda k: nm(lm, LM[k])
        V  = lambda k: lm[LM[k]].visibility

        # ── Landmarks ──────────────────────────────────────────────
        nose  = G('nose')
        l_sh  = G('l_sh');   r_sh  = G('r_sh')
        l_el  = G('l_el');   r_el  = G('r_el')
        l_wr  = G('l_wr');   r_wr  = G('r_wr')
        l_hip = G('l_hip');  r_hip = G('r_hip')
        l_kn  = G('l_kn');   r_kn  = G('r_kn')
        l_ank = G('l_ank');  r_ank = G('r_ank')
        l_ear = G('l_ear');  r_ear = G('r_ear')
        l_heel= G('l_heel'); r_heel= G('r_heel')

        # Normalized (for geometry calculations)
        nl_sh = N('l_sh');  nr_sh = N('r_sh')
        nl_wr = N('l_wr');  nr_wr = N('r_wr')
        nl_el = N('l_el');  nr_el = N('r_el')
        nl_hip= N('l_hip'); nr_hip= N('r_hip')
        nl_ank= N('l_ank'); nr_ank= N('r_ank')

        # ── Camera alignment ────────────────────────────────────────
        off_ang  = angle_at(l_sh, r_sh, nose)
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

        # ── Pick visible side ───────────────────────────────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            shldr, elbow, wrist = l_sh,  l_el,  l_wr
            hip, knee, ankle    = l_hip, l_kn,  l_ank
            heel, ear           = l_heel, l_ear
            n_sh, n_wr, n_el    = nl_sh, nl_wr, nl_el
            n_hip, n_ank        = nl_hip, nl_ank
        else:
            shldr, elbow, wrist = r_sh,  r_el,  r_wr
            hip, knee, ankle    = r_hip, r_kn,  r_ank
            heel, ear           = r_heel, r_ear
            n_sh, n_wr, n_el    = nr_sh, nr_wr, nr_el
            n_hip, n_ank        = nr_hip, nr_ank

        # ── Plank detection (5 signals, score ≥ 3) ─────────────────
        body_horiz   = abs(n_sh[1] - n_ank[1]) < 0.25
        wrist_drop   = n_wr[1] - n_sh[1]     # +ve = wrist below shoulder
        elbow_drop   = n_el[1] - n_sh[1]
        arm_up       = (wrist_drop > 0.04 or elbow_drop > 0.04)
        elbow_ang    = angle_at(shldr, elbow, wrist)
        valid_elbow  = (155 <= elbow_ang <= 185 or 70 <= elbow_ang <= 110)
        z_diff       = n_wr[2] - n_sh[2]
        z_ok         = z_diff > 0.03

        score = (int(body_horiz) + int(arm_up) +
                 int(valid_elbow) + int(z_ok))
        is_plank = body_horiz and arm_up and score >= 3

        if is_plank:
            self.S['plank_cnt'] += 1
            self.S['out_cnt']    = 0
        else:
            self.S['out_cnt']   += 1
            self.S['plank_cnt']  = max(0, self.S['plank_cnt'] - 1)

        confirmed = (self.S['plank_cnt'] >= 8 or
                     (self.S['in_plank'] and self.S['out_cnt'] < 20))

        if not confirmed:
            self._not_in_plank(frame, fw, fh,
                               body_horiz, arm_up, valid_elbow,
                               elbow_ang, wrist_drop, elbow_drop,
                               shldr, hip, ankle, ear, n_sh, n_hip, n_ank)
            return frame

        # ── Entered plank ──────────────────────────────────────────
        if not self.S['in_plank']:
            self.S['in_plank'] = True
            self.S['tick']     = time.perf_counter()
            self.voice.say('start')

        # ── Form checks ─────────────────────────────────────────────
        #
        # CHECK 1: Signed hip deviation from shoulder→ankle line
        #   POSITIVE = hip BELOW line = SAGGING
        #   NEGATIVE = hip ABOVE line = PIKING
        #
        dev       = hip_deviation(n_sh, n_hip, n_ank)

        # CHECK 2: Body angle (shoulder→hip→ankle) — BACKUP for subtle deviations
        # arccos gives 0-180° — always less than 180° when body is bent.
        # Combined with sign of hip_dev to determine sag vs pike.
        # This catches subtle sags (like 3%) that hip_dev threshold might miss.
        body_ang  = angle_at(shldr, hip, ankle)

        neck_ang  = angle_at(ear, shldr, hip)
        sh_col    = int(shldr[0]) - int(wrist[0])    # -ve = collapsing

        bad = np.zeros(5, bool)

        # Sag: hip_dev too positive OR body angle broken AND hip is below line
        if dev > self.T['SAG_THRESH']:
            bad[0] = True
        elif body_ang < self.T['BODY_ANGLE_MIN'] and dev >= 0:
            bad[0] = True   # body bent AND hip below line = subtle sag

        # Pike: hip_dev too negative OR body angle broken AND hip is above line
        if dev < -self.T['PIKE_THRESH']:
            bad[1] = True
        elif body_ang < self.T['BODY_ANGLE_MIN'] and dev < 0:
            bad[1] = True   # body bent AND hip above line = subtle pike

        if neck_ang  < self.T['NECK_DROP_MIN']:   bad[2] = True
        if neck_ang  > self.T['NECK_CRANE_MAX']:  bad[3] = True
        if sh_col    < -(fw * 0.12):              bad[4] = True

        # Per-flag debounce counter
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FEEDBACK_FRAMES']

        # ANY bad flag triggers form-break immediately (no waiting for debounce)
        any_bad_now = bad.any()

        now = time.perf_counter()
        if not any_bad_now:
            # Form is good — tick the timer
            if self.S['grace_start'] is not None:
                self.S['grace_start'] = None
                self.voice.say('form_restored')
            self.S['form_good'] = True
            self.S['running']   = True
            self.S['hold']     += now - self.S['tick']
            self.S['tick']      = now
        else:
            # Bad form — grace period before pausing
            if self.S['grace_start'] is None:
                self.S['grace_start'] = now

            if now - self.S['grace_start'] >= self.T['GRACE_SEC']:
                self.S['form_good'] = False
                self.S['running']   = False
                self.S['tick']      = now
                # Speak highest-priority confirmed bad flag
                for i in range(5):
                    if self.S['fb_show'][i]:
                        self.voice.say(FB[i][3])
                        break
            else:
                # Still in grace — keep timer running
                self.S['hold'] += now - self.S['tick']
                self.S['tick']  = now

        if self.S['hold'] > self.S['best']:
            self.S['best'] = self.S['hold']

        # ── Milestones ─────────────────────────────────────────────
        ht = int(self.S['hold'])
        for ms, key in MILESTONES.items():
            if ht >= ms and ms not in self.S['ms_hit']:
                self.S['ms_hit'].add(ms)
                self.voice.say_now(key)

        if self.S['hold'] >= self.target and not self.S['target_done']:
            self.S['target_done'] = True
            self.voice.say_now('target_hit')

        # ── Draw ───────────────────────────────────────────────────
        self._draw_skeleton(frame, shldr, elbow, wrist,
                            hip, knee, ankle, heel, ear)
        self._draw_alignment(frame, shldr, hip, ankle, dev)
        self._draw_neck(frame, ear, shldr, neck_ang)
        self._draw_hud(frame, fw, fh, dev, neck_ang, body_ang)
        self._draw_feedback(frame)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  DRAW HELPERS
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip, kn, ank, heel, ear):
        bones = [(ear,sh),(sh,el),(el,wr),(sh,hip),(hip,kn),(kn,ank),(ank,heel)]
        for a, b in bones:
            cv2.line(frame, tuple(a), tuple(b), C['cyan'], 3, AA)
        for pt in (ear, sh, el, wr, hip, kn, ank, heel):
            cv2.circle(frame, tuple(pt), 6, C['yellow'], -1, AA)

    def _draw_alignment(self, frame, sh, hip, ank, dev):
        """
        Draw reference line (dotted) + body line (colored by hip deviation).
        GREEN  = good  |  RED = sagging  |  ORANGE = piking
        """
        # Ideal reference line
        dotted_line(frame, sh, ank, C['blue'], gap=10)

        if dev > self.T['SAG_THRESH']:
            col = C['red']
        elif dev < -self.T['PIKE_THRESH']:
            col = C['orange']
        else:
            col = C['green']

        cv2.line(frame, tuple(sh),  tuple(hip), col, 3, AA)
        cv2.line(frame, tuple(hip), tuple(ank), col, 3, AA)

        # Hip position indicator dot
        cv2.circle(frame, tuple(hip), 10, col, -1, AA)

    def _draw_neck(self, frame, ear, sh, neck_ang):
        col = (C['red'] if neck_ang < self.T['NECK_DROP_MIN']
               else C['orange'] if neck_ang > self.T['NECK_CRANE_MAX']
               else C['green'])
        cv2.line(frame, tuple(ear), tuple(sh), col, 2, AA)

    def _draw_hud(self, frame, fw, fh, dev, neck_ang, body_ang=180):
        # Timer
        hold    = self.S['hold']
        best    = self.S['best']
        running = self.S['running']
        pct     = min(hold / max(self.target, 1), 1.0)

        t_col = (0, 180, 0) if running else (40, 40, 180)
        put_label(frame, fmt(hold), 30, 52, scale=1.1,
                  fg=C['white'], bg=t_col)

        status = 'HOLDING' if running else (
                 'PAUSED — FIX FORM' if self.S['in_plank'] else 'WAITING')
        s_col  = (0, 160, 0) if running else (40, 40, 180)
        put_label(frame, status, 30, 88, scale=0.52, bg=s_col)

        # Progress bar
        bx, by, bw, bh = 30, 108, 220, 9
        cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (30,30,30), -1)
        fw2 = int(pct * bw)
        if fw2 > 0:
            cv2.rectangle(frame, (bx, by), (bx+fw2, by+bh),
                          (0,200,80) if pct < 1 else (0,255,200), -1)
        cv2.putText(frame, f'TARGET: {fmt(self.target)}',
                    (bx, by+bh+16), FONT, 0.40, (130,130,130), 1, AA)

        # Best
        put_label(frame, f'BEST: {fmt(best)}',
                  int(fw*0.68), 52, scale=0.58)

        # Form dot
        form_col = (0,220,80) if self.S['form_good'] else (50,50,220)
        cv2.circle(frame, (int(fw*0.68), 90), 8, form_col, -1, AA)
        cv2.putText(frame, 'OK' if self.S['form_good'] else 'FIX FORM',
                    (int(fw*0.68)+14, 95), FONT, 0.45, form_col, 1, AA)

        # Live numbers (small, bottom-left)
        dev_pct = int(dev * 100)
        sign    = '+' if dev_pct >= 0 else ''
        cv2.putText(frame,
                    f'HIP DEV:{sign}{dev_pct}%  BODY:{body_ang}deg  NECK:{neck_ang}deg',
                    (10, fh-15), FONT, 0.38, (120,120,120), 1, AA)

    def _draw_feedback(self, frame):
        for i, (label, y, bg, _) in FB.items():
            if self.S['fb_show'][i]:
                put_label(frame, label, 30, y, scale=0.58,
                          fg=C['white'], bg=bg, pad=10)

    # ─────────────────────────────────────────────────────────────────
    #  STATE HANDLERS
    # ─────────────────────────────────────────────────────────────────

    def _not_in_plank(self, frame, fw, fh,
                      body_horiz, arm_up, valid_elbow,
                      elbow_ang, wrist_drop, elbow_drop,
                      shldr, hip, ankle, ear,
                      n_sh, n_hip, n_ank):
        """Show why not in plank + speak the top issue."""
        if self.S['in_plank']:
            self.S['in_plank']  = False
            self.S['running']   = False
            self.S['plank_cnt'] = 0
            self.S['tick']      = time.perf_counter()

        self._draw_hud(frame, fw, fh, 0.0, 180)

        issues = []  # (y, text, bg, voice_key)
        y = 140; gap = 52

        if not body_horiz:
            issues.append((y, 'LIE DOWN HORIZONTALLY',
                           (30,70,180), 'lie_down')); y += gap
        else:
            if not arm_up:
                if wrist_drop < 0.01 and elbow_drop < 0.01:
                    issues.append((y, 'PUSH UP — LIFT BODY OFF FLOOR',
                                   (20,50,190), 'push_up_arms'))
                else:
                    issues.append((y, 'RAISE HIPS — STRAIGHTEN BODY',
                                   (20,50,190), 'raise_body'))
                y += gap

            if not valid_elbow:
                if elbow_ang < 70:
                    issues.append((y, f'ELBOWS TOO BENT ({elbow_ang}\xb0) — EXTEND',
                                   (150,30,150), 'extend_arms'))
                else:
                    issues.append((y, f'ADJUST ARMS ({elbow_ang}\xb0)',
                                   (150,30,150), 'adjust_arms'))
                y += gap

            # Also check hip position
            dev = hip_deviation(n_sh, n_hip, n_ank)
            if dev > self.T['SAG_THRESH']:
                issues.append((y, f'HIPS TOO LOW — LIFT THEM UP',
                               (20,60,200), 'lift_hips_setup')); y += gap
            elif dev < -self.T['PIKE_THRESH']:
                issues.append((y, f'HIPS TOO HIGH — LOWER THEM',
                               (20,60,200), 'lower_hips_setup')); y += gap

            neck_ang = angle_at(ear, shldr, hip)
            if neck_ang < self.T['NECK_DROP_MIN']:
                issues.append((y, f'NECK STRAINED ({neck_ang}\xb0) — NEUTRAL',
                               (140,20,140), 'head_neutral_setup')); y += gap

        if not issues:
            issues.append((y, 'GET INTO PLANK POSITION',
                           (30,70,160), 'get_into_plank'))

        for (iy, text, bg, _) in issues:
            put_label(frame, text, 30, iy, scale=0.58,
                      fg=C['white'], bg=bg, pad=10)

        if issues:
            self.voice.say(issues[0][3])

        if self.flip:
            frame = cv2.flip(frame, 1)

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        self.S['running'] = False
        self.S['tick']    = time.perf_counter()
        for pt, col in [(nose, C['white']), (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, fh, 0.0, 180)
        put_label(frame, 'USE SIDE VIEW — CAMERA NOT ALIGNED',
                  30, fh-60, scale=0.58, bg=(180,80,20), pad=10)
        self.voice.say('camera')
        if self.flip:
            frame = cv2.flip(frame, 1)

    def _no_person(self, frame, fw, fh):
        now = time.perf_counter()
        self.S['inactive'] += now - self.S['last_t']
        self.S['last_t']    = now
        if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
            self.S.update(hold=0.0, in_plank=False, running=False,
                          ms_hit=set(), target_done=False,
                          inactive=0.0, plank_cnt=0, out_cnt=0)
            self.voice.say('reset')
        self._draw_hud(frame, fw, fh, 0.0, 180)
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
    ap.add_argument('--target', type=int, default=60)
    args = ap.parse_args()

    T      = get_thresholds(args.mode)
    voice  = VoiceCoach(speed=args.speed, mute=args.mute)
    proc   = PlankProcessor(T, flip=args.flip, voice=voice, target=args.target)
    pose   = make_pose()
    cap    = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"🏋  Plank Analyzer  [{args.mode.upper()}]  target={args.target}s")
    print("    Camera: SIDE VIEW at hip height   |   Q = quit\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Plank Analyzer — Q to quit', output)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        voice.stop()
        S = proc.S
        print("\n── Session ─────────────────────────")
        print(f"  Hold : {fmt(S['hold'])}")
        print(f"  Best : {fmt(S['best'])}")
        print(f"  {'✅ Target hit!' if S['hold'] >= proc.target else '❌ Target not reached'}")


if __name__ == '__main__':
    main()