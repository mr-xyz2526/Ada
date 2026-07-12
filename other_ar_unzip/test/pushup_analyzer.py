"""
AI Fitness Trainer - Push-Up Analyzer  (v3 — full rewrite)
============================================================
Install:  pip install opencv-python mediapipe numpy

Run:
    python pushup_analyzer.py
    python pushup_analyzer.py --mode pro
    python pushup_analyzer.py --flip --mute
    python pushup_analyzer.py --speed 7   # 1-10

Camera: SIDE VIEW at chest/shoulder height. Full body visible in profile.

What it tracks:
  • Rep counting  (correct vs incorrect)
  • Hips sagging  (core not engaged — back dips down)
  • Hips piking   (butt raised — back arches up)
  • Elbows flaring (arms too wide)
  • Incomplete rep (didn't go low enough)
  • Head dropping  (neck not neutral)

Voice coaches every phase:
  Going down → at bottom → pushing up → rep complete → form errors
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
#  Single persistent PowerShell — SpeakAsync so every new cue
#  INTERRUPTS and replaces the current phrase instantly.
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ───────────────────────────────────────────
        'camera'        : "Set up a side view camera.",
        'reset'         : "Counters reset.",
        # ── phase coaching ───────────────────────────────────────────
        'go_down'       : "Go down slowly.",
        'at_bottom'     : "Good. Now push up.",
        'push_up'       : "Push up strong.",
        'arms_locked'   : "Lock your arms at the top.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'      : "Good rep!",
        'too_shallow'   : "Too shallow. Go lower next time.",
        'bad_form_rep'  : "Rep not counted. Fix your form.",
        # ── form errors (fire immediately when detected) ─────────────
        'sag_hips'      : "Hips sagging! Tighten your core.",
        'pike_hips'     : "Hips too high! Lower your butt.",
        'flare_elbows'  : "Elbows flaring! Tuck them in.",
        'head_drop'     : "Head dropping! Keep it neutral.",
        'head_up'       : "Chin down. Keep head neutral.",
        # ── milestone counts ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start.",
        '5'  : "5 reps. Keep going!",
        '10' : "10 reps. Amazing!",
        '15' : "15 reps. You are on fire!",
        '20' : "20 reps. Incredible!",
    }

    _COOLDOWN = {
        'camera'        : 7.0,
        'reset'         : 5.0,
        'go_down'       : 3.0,
        'at_bottom'     : 2.0,
        'push_up'       : 2.0,
        'arms_locked'   : 3.0,
        'good_rep'      : 1.5,
        'too_shallow'   : 3.0,
        'bad_form_rep'  : 3.0,
        'sag_hips'      : 4.0,
        'pike_hips'     : 4.0,
        'flare_elbows'  : 4.0,
        'head_drop'     : 4.0,
        'head_up'       : 4.0,
    }

    # SpeakAsync + SpeakAsyncCancelAll = instant interrupt
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
        """Speak with cooldown. Drops stale queued phrases."""
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        phrase = self._get(key)
        # Always replace queue with latest phrase
        while not self._q.empty():
            try: self._q.get_nowait()
            except queue.Empty: break
        self._q.put(phrase)

    def say_now(self, key: str):
        """Speak immediately, no cooldown (rep counts, one-shots)."""
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
    Elbow angle (shoulder→elbow→wrist):
      s1 = UP   : arms extended (~155-180°)
      s2 = MID  : transitioning (~90-154°)
      s3 = DOWN : chest near floor (~50-89°)

    Body alignment uses SIGNED HIP DEVIATION (same as plank):
      hip_dev > +SAG  → hips sagging (back dips)
      hip_dev < -PIKE → hips piking  (butt up)
    This correctly separates SAG from PIKE — pure angle check
    always < 180° for both and can't tell them apart.

    Elbow flare = angle at shoulder between elbow and hip direction.
      High value = elbows pointing out = flaring.
    """
    if mode == 'pro':
        return {
            'ELBOW': {'UP': (155,180), 'MID': (95,154), 'DOWN': (55,94)},
            'SAG_THRESH'        : 0.03,
            'PIKE_THRESH'       : 0.025,
            'BODY_ANGLE_MIN'    : 165,   # backup angle check
            'FLARE_THRESH'      : 50,
            'NECK_DROP_MIN'     : 150,
            'NECK_CRANE_MAX'    : 183,
            'OFFSET_THRESH'     : 55.0,
            'OFFSET_FRAMES'     : 20,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 4,
        }
    else:
        return {
            'ELBOW': {'UP': (145,180), 'MID': (90,144), 'DOWN': (50,89)},
            'SAG_THRESH'        : 0.04,
            'PIKE_THRESH'       : 0.035,
            'BODY_ANGLE_MIN'    : 160,
            'FLARE_THRESH'      : 65,
            'NECK_DROP_MIN'     : 140,
            'NECK_CRANE_MAX'    : 185,
            'OFFSET_THRESH'     : 55.0,
            'OFFSET_FRAMES'     : 20,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 5,
        }


# ══════════════════════════════════════════════════════════════════════
#  GEOMETRY
# ══════════════════════════════════════════════════════════════════════

def angle_at(p1, p2, p3):
    """Joint angle at p2 (degrees, 0-180)."""
    v1 = (p1 - p2).astype(float)
    v2 = (p3 - p2).astype(float)
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return int(np.degrees(np.arccos(np.clip(cos, -1.0, 1.0))))


def hip_dev_norm(sh_n, hip_n, ank_n):
    """
    Signed deviation of hip from shoulder→ankle line, in normalized coords.
    +ve = hip BELOW line (sagging).  -ve = hip ABOVE line (piking).
    """
    sh_x, sh_y  = sh_n[0], sh_n[1]
    ak_x, ak_y  = ank_n[0], ank_n[1]
    hp_x, hp_y  = hip_n[0], hip_n[1]
    dx  = ak_x - sh_x
    t   = (hp_x - sh_x) / dx if abs(dx) > 0.01 else 0.5
    return hp_y - (sh_y + t * (ak_y - sh_y))


def px(lm, idx, fw, fh):
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


def nm(lm, idx):
    p = lm[idx]
    return np.array([p.x, p.y, p.z])


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
    'mid'     : (40,   40,  80),
    'lt_blue' : (255, 200, 100),
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


def label(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


def dotted_v(img, pt, y0, y1, color, gap=8):
    for y in range(y0, y1, gap):
        cv2.circle(img, (pt[0], y), 2, color, -1, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (on-screen text, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('HIPS SAGGING — TIGHTEN CORE',     155, (20,  50, 200), 'sag_hips'),
    1: ('HIPS TOO HIGH — LOWER YOUR BUTT', 155, (20,  50, 200), 'pike_hips'),
    2: ('ELBOWS FLARING — TUCK THEM IN',   210, (180, 40,  40), 'flare_elbows'),
    3: ('GO LOWER — FULL RANGE OF MOTION', 265, (180, 40,  40), 'too_shallow'),
    4: ('HEAD DROPPING — KEEP NEUTRAL',    320, (130, 30, 160), 'head_drop'),
    5: ('CHIN UP — KEEP HEAD NEUTRAL',     320, (130, 30, 160), 'head_up'),
}


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

LM = dict(nose=0, l_ear=7, r_ear=8,
          l_sh=11, r_sh=12, l_el=13, r_el=14, l_wr=15, r_wr=16,
          l_hip=23, r_hip=24, l_kn=25, r_kn=26, l_ank=27, r_ank=28)


class PushupProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            # ── rep state machine ─────────────────────────────────────
            # s1=UP  s2=MID  s3=DOWN
            seq          = [],     # current rep sequence
            prev_state   = None,
            bad_form     = False,  # any form error in current rep

            # ── counters ──────────────────────────────────────────────
            correct      = 0,
            incorrect    = 0,

            # ── per-frame feedback ────────────────────────────────────
            fb_cnt       = np.zeros(6, int),
            fb_show      = np.zeros(6, bool),

            # ── voice phase tracking ──────────────────────────────────
            last_phase   = None,   # which phase we last announced
            bottom_said  = False,  # said "push up" at bottom this rep

            # ── camera ────────────────────────────────────────────────
            cam_cnt      = 0,

            # ── inactivity ────────────────────────────────────────────
            inactive     = 0.0,
            last_t       = time.perf_counter(),
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

        # Normalized
        nl_sh  = N('l_sh');  nr_sh  = N('r_sh')
        nl_wr  = N('l_wr');  nr_wr  = N('r_wr')
        nl_el  = N('l_el');  nr_el  = N('r_el')
        nl_hip = N('l_hip'); nr_hip = N('r_hip')
        nl_ank = N('l_ank'); nr_ank = N('r_ank')

        # ── Camera alignment ───────────────────────────────────────
        off_ang = angle_at(l_sh, r_sh, nose)
        sp_px   = abs(int(l_sh[0]) - int(r_sh[0]))
        vd      = abs(V('l_sh') - V('r_sh'))
        is_front = (off_ang > self.T['OFFSET_THRESH']
                    and sp_px > fw * 0.18
                    and vd < 0.25)
        self.S['cam_cnt'] = self.S['cam_cnt'] + 1 if is_front else 0
        if self.S['cam_cnt'] >= self.T['OFFSET_FRAMES']:
            self._bad_camera(frame, fw, fh, nose, l_sh, r_sh)
            return frame
        if not is_front:
            self.S['cam_cnt'] = 0

        # ── Pick visible side ──────────────────────────────────────
        left = V('l_sh') >= V('r_sh')
        if left:
            sh,  el,  wr  = l_sh,  l_el,  l_wr
            hip, kn,  ank = l_hip, l_kn,  l_ank
            ear           = l_ear
            n_sh, n_wr    = nl_sh, nl_wr
            n_el, n_hip   = nl_el, nl_hip
            n_ank         = nl_ank
        else:
            sh,  el,  wr  = r_sh,  r_el,  r_wr
            hip, kn,  ank = r_hip, r_kn,  r_ank
            ear           = r_ear
            n_sh, n_wr    = nr_sh, nr_wr
            n_el, n_hip   = nr_el, nr_hip
            n_ank         = nr_ank

        # ── Key angles ─────────────────────────────────────────────
        elbow_ang = angle_at(sh, el, wr)        # drives rep counting
        flare_ang = angle_at(el, sh, hip)        # elbow flare (at shoulder)
        neck_ang  = angle_at(ear, sh, hip)       # head position

        # Body alignment: signed hip deviation (fixes pike detection)
        dev       = hip_dev_norm(n_sh, n_hip, n_ank)
        body_ang  = angle_at(sh, hip, ank)       # backup check

        # ── Form checks ────────────────────────────────────────────
        bad = np.zeros(6, bool)

        # SAG: hip below ideal line  OR  body angle broken downward
        if dev > self.T['SAG_THRESH']:
            bad[0] = True
        elif body_ang < self.T['BODY_ANGLE_MIN'] and dev >= 0:
            bad[0] = True

        # PIKE: hip above ideal line  OR  body angle broken upward
        if dev < -self.T['PIKE_THRESH']:
            bad[1] = True
        elif body_ang < self.T['BODY_ANGLE_MIN'] and dev < 0:
            bad[1] = True

        # ELBOW FLARE
        if flare_ang > self.T['FLARE_THRESH']:
            bad[2] = True

        # HEAD
        if neck_ang < self.T['NECK_DROP_MIN']:
            bad[4] = True
        elif neck_ang > self.T['NECK_CRANE_MAX']:
            bad[5] = True

        # Debounce per flag
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FB_FRAMES']

        # Mark bad form for current rep
        if bad.any():
            self.S['bad_form'] = True

        # ── Voice for form errors (fire on first confirmed frame) ──
        for i in range(6):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break   # speak only highest-priority at once

        # ── State machine ──────────────────────────────────────────
        state = self._state(elbow_ang)
        self._update_seq(state)

        # ── Voice phase coaching ───────────────────────────────────
        self._coach_phase(state, elbow_ang)

        # ── Rep counting ───────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and not self.S['bad_form']:
                # Perfect rep: s2 → s3 → s2
                self.S['correct'] += 1
                n = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Rep #{n} — correct")
            elif 's3' not in seq and len(seq) >= 1:
                # Came back up without reaching bottom
                self.S['incorrect'] += 1
                self.S['fb_cnt'][3] = self.T['FB_FRAMES'] + 1
                self.S['fb_show'][3] = True
                self.voice.say('too_shallow')
                print(f"❌  Too shallow")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")
            # Reset for next rep
            self.S['seq']        = []
            self.S['bad_form']   = False
            self.S['bottom_said']= False

        self.S['prev_state'] = state

        # ── Inactivity ─────────────────────────────────────────────
        now = time.perf_counter()
        if state == self.S.get('last_state_for_inact'):
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']            = 0.0
            self.S['last_state_for_inact'] = state
        self.S['last_t'] = now

        # ── Draw ───────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip, kn, ank, ear)
        self._draw_body_line(frame, sh, hip, ank, dev, body_ang)
        self._draw_elbow_arc(frame, el, sh, wr, elbow_ang)
        dotted_v(frame, el, el[1]-50, el[1]+30, C['blue'])

        # Live angle readouts
        dev_pct = int(dev * 100)
        sign    = '+' if dev_pct >= 0 else ''
        cv2.putText(frame,
                    f'ELBOW:{elbow_ang}  BODY:{body_ang}  HIP:{sign}{dev_pct}%  NECK:{neck_ang}',
                    (10, fh-12), FONT, 0.36, (110,110,110), 1, AA)

        self._draw_hud(frame, fw, state)
        self._draw_feedback(frame)

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────

    def _state(self, elbow_ang):
        e = self.T['ELBOW']
        if e['UP'][0]   <= elbow_ang <= e['UP'][1]:   return 's1'
        if e['MID'][0]  <= elbow_ang <= e['MID'][1]:  return 's2'
        if e['DOWN'][0] <= elbow_ang <= e['DOWN'][1]: return 's3'
        return None

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

    def _coach_phase(self, state, elbow_ang):
        """Say coaching cue when entering each new phase."""
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            # Entering mid going DOWN
            self.voice.say('go_down')

        elif state == 's3':
            # Reached bottom
            if not self.S['bottom_said']:
                self.S['bottom_said'] = True
                self.voice.say('at_bottom')

        elif state == 's2' and 's3' in self.S['seq']:
            # Coming back UP through mid
            self.voice.say('push_up')

        elif state == 's1':
            # Reached top — lock arms
            self.voice.say('arms_locked')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip, kn, ank, ear):
        bones = [(ear,sh),(sh,el),(el,wr),(sh,hip),(hip,kn),(kn,ank)]
        for a, b in bones:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 3, AA)
        for pt in (ear, sh, el, wr, hip, kn, ank):
            cv2.circle(frame, tuple(pt), 6, C['yellow'], -1, AA)

    def _draw_body_line(self, frame, sh, hip, ank, dev, body_ang):
        """Color body line by sag/pike/good, show ideal reference line."""
        T = self.T
        if dev > T['SAG_THRESH'] or (body_ang < T['BODY_ANGLE_MIN'] and dev >= 0):
            col = C['red']
        elif dev < -T['PIKE_THRESH'] or (body_ang < T['BODY_ANGLE_MIN'] and dev < 0):
            col = C['orange']
        else:
            col = C['green']

        # Ideal straight line (dotted)
        dist = int(np.linalg.norm(ank - sh))
        for i in range(0, dist, 10):
            t  = i / max(dist, 1)
            px_ = int(sh[0] + t*(ank[0]-sh[0]))
            py_ = int(sh[1] + t*(ank[1]-sh[1]))
            cv2.circle(frame, (px_, py_), 2, C['blue'], -1, AA)

        cv2.line(frame, tuple(sh),  tuple(hip), col, 3, AA)
        cv2.line(frame, tuple(hip), tuple(ank), col, 3, AA)
        cv2.circle(frame, tuple(hip), 9, col, -1, AA)

        # Label at hip
        dev_pct = int(dev * 100)
        sign    = '+' if dev_pct >= 0 else ''
        cv2.putText(frame, f'{sign}{dev_pct}%',
                    (hip[0]+12, hip[1]), FONT, 0.46, col, 2, AA)

    def _draw_elbow_arc(self, frame, el, sh, wr, ang):
        """Angle arc at elbow coloured by phase."""
        T = self.T['ELBOW']
        if T['DOWN'][0] <= ang <= T['DOWN'][1]:
            col = C['green']
        elif T['UP'][0] <= ang <= T['UP'][1]:
            col = C['cyan']
        else:
            col = C['yellow']
        v1   = (sh - el).astype(float)
        v2   = (wr - el).astype(float)
        sa   = int(np.degrees(np.arctan2(v1[1], v1[0])))
        ea   = int(np.degrees(np.arctan2(v2[1], v2[0])))
        cv2.ellipse(frame, tuple(el), (26,26), 0, sa, ea, col, 2, AA)
        mid  = np.radians((sa + ea) / 2)
        tx   = int(el[0] + 42 * np.cos(mid))
        ty   = int(el[1] + 42 * np.sin(mid))
        cv2.putText(frame, str(ang), (tx, ty), FONT, 0.55, col, 2, AA)

    def _draw_hud(self, frame, fw, state):
        phase = {'s1':'UP ↑', 's2':'MOVING', 's3':'DOWN ↓'}.get(state, '---')
        p_col = {'s1': (0,160,0), 's2': (0,160,200), 's3': (0,80,220)}.get(state, C['dark'])

        label(frame, f'PHASE: {phase}',  30, 34, bg=p_col)
        label(frame, f'CORRECT:   {self.S["correct"]}',
              int(fw*0.68), 34,  bg=(0,140,0))
        label(frame, f'INCORRECT: {self.S["incorrect"]}',
              int(fw*0.68), 84,  bg=(180,20,20))

        # Bad form indicator
        if self.S['bad_form']:
            label(frame, 'FORM ERROR THIS REP',
                  30, 88, scale=0.52, bg=(180,20,20))

    def _draw_feedback(self, frame):
        shown = set()
        for i, (text, y, bg, _) in FB.items():
            if self.S['fb_show'][i] and i not in shown:
                label(frame, text, 30, y, scale=0.58, fg=C['white'], bg=bg, pad=10)
                shown.add(i)

    # ─────────────────────────────────────────────────────────────────
    #  EDGE CASES
    # ─────────────────────────────────────────────────────────────────

    def _bad_camera(self, frame, fw, fh, nose, l_sh, r_sh):
        for pt, col in [(nose, C['white']), (l_sh, C['yellow']), (r_sh, C['magenta'])]:
            cv2.circle(frame, tuple(pt), 7, col, -1)
        self._draw_hud(frame, fw, None)
        label(frame, 'USE SIDE VIEW — CAMERA NOT ALIGNED',
              30, fh-55, scale=0.56, bg=(180,80,20), pad=10)
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
        self._draw_hud(frame, fw, None)
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
    proc  = PushupProcessor(T, flip=args.flip, voice=voice)
    pose  = make_pose()
    cap   = cv2.VideoCapture(0 if args.video is None else args.video)

    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"💪  Push-Up Analyzer  [{args.mode.upper()}]")
    print("    Camera: SIDE VIEW at chest height   |   Q = quit\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('AI Push-Up Analyzer — Q to quit', output)
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