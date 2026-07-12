"""
AI Fitness Trainer - Incline Dumbbell Press Analyzer
=====================================================
Adapted from pushup_analyzer.py for Incline DB Press.

Install:  pip install opencv-python mediapipe numpy

Run:
    python incline_db_press_analyzer.py
    python incline_db_press_analyzer.py --mode pro
    python incline_db_press_analyzer.py --flip --mute
    python incline_db_press_analyzer.py --speed 7

Camera: SIDE VIEW at bench/shoulder height. Full upper body + arms visible.

Exercise:  Incline Dumbbell Press
  • Bench angle: 30–45°
  • Start: arms extended overhead (~160–180° elbow)
  • Bottom: elbows bent (~70–90°), upper arms ~45–75° from torso
  • Press path: arc inward + upward, elbows track slightly inward

What it tracks:
  • Rep counting (correct vs incorrect)
  • Elbow flare (elbows should stay ~45–60° from torso, not wing out >75°)
  • Incomplete rep (didn't lower to full stretch)
  • Elbows locked / hyperextended at top
  • Wrist alignment (wrist should stay over elbow, not cave inward)
  • Shoulder angle (upper arm relative to torso — checks incline path)

Key angles (SIDE VIEW):
  • Elbow angle  = shoulder → elbow → wrist      (drives rep state)
  • Shoulder angle = hip    → shoulder → elbow   (upper arm path)
  • Neck/head angle checked only when relevant

Voice coaches every phase:
  Lowering → at bottom → pressing up → rep complete → form errors
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
#  VOICE COACH  (unchanged architecture, new phrases)
# ══════════════════════════════════════════════════════════════════════

class VoiceCoach:

    PHRASES = {
        # ── camera / setup ───────────────────────────────────────────
        'camera'          : "Set up a side view camera.",
        'reset'           : "Counters reset.",
        # ── phase coaching ───────────────────────────────────────────
        'lower'           : "Lower the dumbbells slowly.",
        'at_bottom'       : "Good stretch. Now press.",
        'press_up'        : "Press up strong.",
        'arms_extended'   : "Full extension at the top.",
        # ── rep results ──────────────────────────────────────────────
        'good_rep'        : "Good rep!",
        'too_shallow'     : "Too shallow. Lower more next time.",
        'bad_form_rep'    : "Rep not counted. Fix your form.",
        # ── form errors ──────────────────────────────────────────────
        'flare_elbows'    : "Elbows flaring! Tuck them slightly.",
        'elbows_in'       : "Elbows too close! Open them a bit.",
        'incomplete_top'  : "Extend fully at the top.",
        'wrist_cave'      : "Keep wrists straight over elbows.",
        'shoulder_path'   : "Control the arc. Don't let arms drift.",
        # ── milestone counts ─────────────────────────────────────────
        '1'  : "1 rep.",
        '2'  : "2 reps.",
        '3'  : "3 reps. Great start.",
        '5'  : "5 reps. Keep going!",
        '8'  : "8 reps. Excellent!",
        '10' : "10 reps. Amazing!",
        '12' : "12 reps. Incredible!",
        '15' : "15 reps. You are on fire!",
    }
    
    _COOLDOWN = {
        'camera'          : 7.0,
        'reset'           : 5.0,
        'lower'           : 3.0,
        'at_bottom'       : 2.0,
        'press_up'        : 2.0,
        'arms_extended'   : 3.0,
        'good_rep'        : 1.5,
        'too_shallow'     : 3.0,
        'bad_form_rep'    : 3.0,
        'flare_elbows'    : 4.0,
        'elbows_in'       : 4.0,
        'incomplete_top'  : 4.0,
        'wrist_cave'      : 4.0,
        'shoulder_path'   : 4.0,
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
        if self.mute:
            return
        now = time.perf_counter()
        if now - self._cd.get(key, 0.0) < self._COOLDOWN.get(key, 3.0):
            return
        self._cd[key] = now
        phrase = self._get(key)
        while not self._q.empty():
            try: self._q.get_nowait()
            except queue.Empty: break
        self._q.put(phrase)
    
    def say_now(self, key: str):
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
#  THRESHOLDS  —  Incline DB Press specific
# ══════════════════════════════════════════════════════════════════════
#
#  ELBOW ANGLE  (shoulder → elbow → wrist)
#  ─────────────────────────────────────────
#  s1 = TOP  : arms nearly extended   165–180°
#  s2 = MID  : transition             95–164°
#  s3 = BOT  : full stretch / bottom  60–94°
#
#  SHOULDER ANGLE  (hip → shoulder → elbow)
#  ─────────────────────────────────────────
#  On an incline bench the torso is ~30–45° from horizontal.
#  At the bottom the upper arm should be ~45–75° from torso → shoulder
#  angle (hip–sh–el) ≈ 100–130° in side view.
#  At the top the upper arm rises and shoulder angle opens to ~140–165°.
#
#  ELBOW FLARE  (angle of elbow relative to torso line)
#  ─────────────────────────────────────────────────────
#  Measured as angle_at(wrist, elbow, shoulder).
#  >75° in side view = elbows winging too far out (flare).
#  <30° = elbows too tucked in (chicken-wing).
#
# ══════════════════════════════════════════════════════════════════════

def get_thresholds(mode='beginner'):
    if mode == 'pro':
        return {
            # Rep state from elbow angle
            'ELBOW': {
                'TOP': (165, 180),   # arms extended at top
                'MID': (95,  164),   # transition
                'BOT': (60,   94),   # at bottom / full stretch
            },
            # Shoulder angle (hip→sh→el) for arc quality check
            'SHOULDER_BOT_MIN'  : 95,    # upper arm at least this angle at bottom
            'SHOULDER_BOT_MAX'  : 135,   # upper arm should not exceed this at bottom
            'SHOULDER_TOP_MIN'  : 140,   # upper arm angle at top

            # Elbow flare: angle_at(wrist, elbow, shoulder) in side view
            # Out-of-plane flare is harder to see from side; we use
            # the angle between forearm and upper arm projected laterally.
            # We use angle_at(hip, shoulder, elbow) as upper-arm path proxy.
            'FLARE_MAX'         : 72,    # shoulder→elbow→wrist angle ° — too wide
            'FLARE_MIN'         : 28,    # too tucked

            # Wrist alignment: wrist should stay ~above elbow (x offset in px, normalised)
            'WRIST_DRIFT_NORM'  : 0.07,  # max normalised horizontal wrist–elbow offset

            # Camera / general
            'OFFSET_THRESH'     : 55.0,
            'OFFSET_FRAMES'     : 20,
            'INACTIVE_THRESH'   : 15.0,
            'FB_FRAMES'         : 4,
        }
    else:  # beginner — slightly more lenient
        return {
            'ELBOW': {
                'TOP': (155, 180),
                'MID': (90,  154),
                'BOT': (55,   89),
            },
            'SHOULDER_BOT_MIN'  : 90,
            'SHOULDER_BOT_MAX'  : 140,
            'SHOULDER_TOP_MIN'  : 135,

            'FLARE_MAX'         : 78,
            'FLARE_MIN'         : 22,

            'WRIST_DRIFT_NORM'  : 0.10,

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


def px(lm, idx, fw, fh):
    p = lm[idx]
    return np.array([int(p.x * fw), int(p.y * fh)])


def nm(lm, idx):
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
    'mid'     : (40,   40,  80),
    'lt_blue' : (255, 200, 100),
    'teal'    : (180, 220,   0),
}


def rr(img, x1, y1, x2, y2, r, color):
    cv2.rectangle(img, (x1+r, y1),   (x2-r, y1+r), color, -1)
    cv2.rectangle(img, (x1+r, y2-r), (x2-r, y2),   color, -1)
    cv2.rectangle(img, (x1,   y1+r), (x1+r, y2-r), color, -1)
    cv2.rectangle(img, (x2-r, y1+r), (x2,   y2-r), color, -1)
    cv2.rectangle(img, (x1+r, y1+r), (x2-r, y2-r), color, -1)
    for cx, cy, sa, ea in [(x1+r, y1+r, 180, 270), (x2-r, y1+r, 270, 360),
                           (x1+r, y2-r,  90, 180), (x2-r, y2-r,   0,  90)]:
        cv2.ellipse(img, (cx, cy), (r, r), 0, sa, ea, color, -1)


def label(img, text, x, y, scale=0.60, fg=None, bg=None, pad=8):
    if fg is None: fg = C['white']
    if bg is None: bg = C['dark']
    (tw, th), _ = cv2.getTextSize(text, FONT, scale, 2)
    rr(img, x-pad, y-th-pad, x+tw+pad, y+pad, 6, bg)
    cv2.putText(img, text, (x, y), FONT, scale, fg, 2, AA)


# ══════════════════════════════════════════════════════════════════════
#  FEEDBACK SLOTS
#  idx → (on-screen text, y-pos, bg-color, voice-key)
# ══════════════════════════════════════════════════════════════════════

FB = {
    0: ('ELBOWS FLARING — TUCK IN SLIGHTLY',   155, (180, 40,  40), 'flare_elbows'),
    1: ('ELBOWS TOO CLOSE — OPEN SLIGHTLY',    155, (180, 40,  40), 'elbows_in'),
    2: ('WRIST CAVING — KEEP OVER ELBOW',      210, (20,  80, 180), 'wrist_cave'),
    3: ('GO LOWER — FULL STRETCH AT BOTTOM',   265, (180, 40,  40), 'too_shallow'),
    4: ('EXTEND FULLY AT THE TOP',             320, (20, 130,  20), 'incomplete_top'),
    5: ('CONTROL THE ARC — ARMS DRIFTING',     375, (130, 30, 160), 'shoulder_path'),
}


# ══════════════════════════════════════════════════════════════════════
#  LANDMARK MAP
# ══════════════════════════════════════════════════════════════════════

LM = dict(nose=0, l_ear=7, r_ear=8,
          l_sh=11, r_sh=12, l_el=13, r_el=14, l_wr=15, r_wr=16,
          l_hip=23, r_hip=24, l_kn=25, r_kn=26, l_ank=27, r_ank=28)


# ══════════════════════════════════════════════════════════════════════
#  FRAME PROCESSOR
# ══════════════════════════════════════════════════════════════════════

class InclineDBPressProcessor:

    def __init__(self, T, flip=False, voice=None):
        self.T     = T
        self.flip  = flip
        self.voice = voice or VoiceCoach(mute=True)

        self.S = dict(
            seq          = [],
            prev_state   = None,
            bad_form     = False,

            correct      = 0,
            incorrect    = 0,

            fb_cnt       = np.zeros(6, int),
            fb_show      = np.zeros(6, bool),

            last_phase   = None,
            bottom_said  = False,

            cam_cnt      = 0,

            inactive     = 0.0,
            last_t       = time.perf_counter(),
        )

    # ─────────────────────────────────────────────────────────────────
    #  MAIN PROCESS
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

        nl_sh  = N('l_sh');  nr_sh  = N('r_sh')
        nl_el  = N('l_el');  nr_el  = N('r_el')
        nl_wr  = N('l_wr');  nr_wr  = N('r_wr')
        nl_hip = N('l_hip'); nr_hip = N('r_hip')

        # ── Camera alignment ───────────────────────────────────────
        off_ang  = angle_at(l_sh, r_sh, nose)
        sp_px    = abs(int(l_sh[0]) - int(r_sh[0]))
        vd       = abs(V('l_sh') - V('r_sh'))
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
            sh, el, wr   = l_sh, l_el, l_wr
            hip          = l_hip
            n_sh, n_el   = nl_sh, nl_el
            n_wr, n_hip  = nl_wr, nl_hip
        else:
            sh, el, wr   = r_sh, r_el, r_wr
            hip          = r_hip
            n_sh, n_el   = nr_sh, nr_el
            n_wr, n_hip  = nr_wr, nr_hip

        # ── Key angles ─────────────────────────────────────────────
        #  Elbow angle: shoulder → elbow → wrist  (primary rep driver)
        elbow_ang    = angle_at(sh, el, wr)

        #  Shoulder angle: hip → shoulder → elbow  (upper arm path)
        shoulder_ang = angle_at(hip, sh, el)

        #  Elbow flare proxy in side view:
        #  Angle at elbow between upper arm (sh) and forearm (wr) — already elbow_ang.
        #  Additional flare check: angle_at(sh, el, wr) deviation from the chest plane.
        #  From side, we use angle_at(wr, el, sh) which equals elbow_ang.
        #  To catch out-of-plane flare we compare normalized z-coordinates of elbow vs wrist.
        n_el_z = n_el[2]
        n_wr_z = n_wr[2]
        z_flare = n_el_z - n_wr_z   # positive = elbow behind/flaring relative to wrist

        #  Wrist horizontal drift relative to elbow (normalised x)
        wrist_drift = abs(n_wr[0] - n_el[0])

        # ── Form checks ────────────────────────────────────────────
        bad = np.zeros(6, bool)

        state = self._state(elbow_ang)

        # Elbow FLARE: shoulder angle too wide (elbows wing out)
        if shoulder_ang > self.T['FLARE_MAX']:
            bad[0] = True

        # Elbows TOO CLOSE (chicken wing / too narrow)
        if shoulder_ang < self.T['FLARE_MIN']:
            bad[1] = True

        # Wrist cave (wrist drifts inward/outward beyond threshold)
        if wrist_drift > self.T['WRIST_DRIFT_NORM']:
            bad[2] = True

        # Incomplete top (stayed in MID, never reached TOP in this rep)
        # Checked at rep completion instead of per-frame (handled below)

        # Shoulder arc drift (only check when actually pressing/lowering)
        if state == 's3':  # at bottom
            # upper arm should be in valid range at bottom
            if shoulder_ang < self.T['SHOULDER_BOT_MIN'] or shoulder_ang > self.T['SHOULDER_BOT_MAX']:
                bad[5] = True
        if state == 's1':  # at top
            if shoulder_ang < self.T['SHOULDER_TOP_MIN']:
                bad[4] = True  # incomplete top extension

        # Debounce
        self.S['fb_cnt'][bad]  += 1
        self.S['fb_cnt'][~bad]  = 0
        self.S['fb_show']       = self.S['fb_cnt'] >= self.T['FB_FRAMES']

        if bad.any():
            self.S['bad_form'] = True

        # ── Voice form cues ────────────────────────────────────────
        for i in range(6):
            if self.S['fb_show'][i]:
                self.voice.say(FB[i][3])
                break

        # ── State machine ──────────────────────────────────────────
        self._update_seq(state)
        self._coach_phase(state, elbow_ang)

        # ── Rep counting ───────────────────────────────────────────
        if state == 's1' and self.S['prev_state'] != 's1':
            seq = self.S['seq']
            if len(seq) == 3 and not self.S['bad_form']:
                # Full rep: MID→BOT→MID
                self.S['correct'] += 1
                n   = self.S['correct']
                key = str(n) if str(n) in VoiceCoach.PHRASES else 'good_rep'
                self.voice.say_now(key)
                print(f"✅  Rep #{n} — correct")
            elif 's3' not in seq and len(seq) >= 1:
                self.S['incorrect'] += 1
                self.S['fb_cnt'][3]  = self.T['FB_FRAMES'] + 1
                self.S['fb_show'][3] = True
                self.voice.say('too_shallow')
                print(f"❌  Too shallow")
            elif self.S['bad_form']:
                self.S['incorrect'] += 1
                self.voice.say('bad_form_rep')
                print(f"❌  Bad form rep")
            # Reset
            self.S['seq']        = []
            self.S['bad_form']   = False
            self.S['bottom_said'] = False

        self.S['prev_state'] = state

        # ── Inactivity reset ───────────────────────────────────────
        now = time.perf_counter()
        if state == self.S.get('last_state_for_inact'):
            self.S['inactive'] += now - self.S['last_t']
            if self.S['inactive'] >= self.T['INACTIVE_THRESH']:
                self.S['correct']   = 0
                self.S['incorrect'] = 0
                self.S['inactive']  = 0.0
                self.voice.say('reset')
        else:
            self.S['inactive']             = 0.0
            self.S['last_state_for_inact'] = state
        self.S['last_t'] = now

        # ── Draw ───────────────────────────────────────────────────
        self._draw_skeleton(frame, sh, el, wr, hip)
        self._draw_angle_arc(frame, el, sh, wr, elbow_ang, 'elbow')
        self._draw_angle_arc(frame, sh, hip, el, shoulder_ang, 'shoulder')
        self._draw_hud(frame, fw, state, shoulder_ang)
        self._draw_feedback(frame)

        # Live angle bar at bottom
        cv2.putText(
            frame,
            f'ELBOW: {elbow_ang}°   SHOULDER: {shoulder_ang}°   WRIST-DRIFT: {wrist_drift:.2f}',
            (10, fh - 12), FONT, 0.38, (130, 130, 130), 1, AA
        )

        if self.flip:
            frame = cv2.flip(frame, 1)
        return frame

    # ─────────────────────────────────────────────────────────────────
    #  STATE MACHINE
    # ─────────────────────────────────────────────────────────────────
    
    def _state(self, elbow_ang):
        e = self.T['ELBOW']
        if e['TOP'][0] <= elbow_ang <= e['TOP'][1]: return 's1'
        if e['MID'][0] <= elbow_ang <= e['MID'][1]: return 's2'
        if e['BOT'][0] <= elbow_ang <= e['BOT'][1]: return 's3'
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
        if state == self.S['last_phase']:
            return
        self.S['last_phase'] = state

        if state == 's2' and 's3' not in self.S['seq']:
            self.voice.say('lower')
        elif state == 's3':
            if not self.S['bottom_said']:
                self.S['bottom_said'] = True
                self.voice.say('at_bottom')
        elif state == 's2' and 's3' in self.S['seq']:
            self.voice.say('press_up')
        elif state == 's1':
            self.voice.say('arms_extended')

    # ─────────────────────────────────────────────────────────────────
    #  DRAWING
    # ─────────────────────────────────────────────────────────────────

    def _draw_skeleton(self, frame, sh, el, wr, hip):
        """Draw upper-body bones relevant to incline press."""
        bones = [(hip, sh), (sh, el), (el, wr)]
        for a, b in bones:
            cv2.line(frame, tuple(a), tuple(b), C['lt_blue'], 3, AA)
        for pt in (sh, el, wr, hip):
            cv2.circle(frame, tuple(pt), 6, C['yellow'], -1, AA)

    def _draw_angle_arc(self, frame, vertex, p1, p2, ang, kind):
        """
        Draw angle arc at `vertex` between vectors to p1 and p2.
        kind = 'elbow' or 'shoulder' → different colours/sizes.
        """
        e = self.T['ELBOW']
        if kind == 'elbow':
            radius = 26
            if e['BOT'][0] <= ang <= e['BOT'][1]:
                col = C['green']    # at bottom — good stretch
            elif e['TOP'][0] <= ang <= e['TOP'][1]:
                col = C['cyan']     # at top — extended
            else:
                col = C['yellow']
        else:  # shoulder
            radius = 22
            # Colour by whether upper arm path is good
            bot_ok = self.T['SHOULDER_BOT_MIN'] <= ang <= self.T['SHOULDER_BOT_MAX']
            col = C['teal'] if bot_ok else C['orange']

        v1 = (p1 - vertex).astype(float)
        v2 = (p2 - vertex).astype(float)
        sa = int(np.degrees(np.arctan2(v1[1], v1[0])))
        ea = int(np.degrees(np.arctan2(v2[1], v2[0])))
        cv2.ellipse(frame, tuple(vertex), (radius, radius), 0, sa, ea, col, 2, AA)

        mid  = np.radians((sa + ea) / 2)
        tx   = int(vertex[0] + (radius + 18) * np.cos(mid))
        ty   = int(vertex[1] + (radius + 18) * np.sin(mid))
        prefix = 'E:' if kind == 'elbow' else 'S:'
        cv2.putText(frame, f'{prefix}{ang}°', (tx, ty), FONT, 0.50, col, 2, AA)

    def _draw_hud(self, frame, fw, state, shoulder_ang):
        phase_map = {'s1': 'TOP ↑', 's2': 'MOVING', 's3': 'BOTTOM ↓'}
        phase     = phase_map.get(state, '---')
        p_col     = {'s1': (0, 160, 0), 's2': (0, 160, 200), 's3': (0, 80, 220)}.get(state, C['dark'])

        label(frame, f'PHASE: {phase}',          30,           34, bg=p_col)
        label(frame, f'CORRECT:   {self.S["correct"]}',
              int(fw * 0.68), 34,  bg=(0, 140, 0))
        label(frame, f'INCORRECT: {self.S["incorrect"]}',
              int(fw * 0.68), 84,  bg=(180, 20, 20))

        # Show target angle range for current phase
        e = self.T['ELBOW']
        if state == 's3':
            rng = f'Target elbow: {e["BOT"][0]}–{e["BOT"][1]}°'
            label(frame, rng, 30, 84, scale=0.50, bg=(0, 80, 150))
        elif state == 's1':
            rng = f'Target elbow: {e["TOP"][0]}–{e["TOP"][1]}°'
            label(frame, rng, 30, 84, scale=0.50, bg=(0, 120, 0))

        if self.S['bad_form']:
            label(frame, 'FORM ERROR THIS REP', 30, 130, scale=0.52, bg=(180, 20, 20))

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
        self._draw_hud(frame, fw, None, 0)
        label(frame, 'USE SIDE VIEW — CAMERA NOT ALIGNED',
              30, fh - 55, scale=0.56, bg=(180, 80, 20), pad=10)
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
#  model_complexity=2 for best landmark accuracy (especially depth/z)
# ══════════════════════════════════════════════════════════════════════

def make_pose():
    return mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,   # 👈 change from 2 → 1
        smooth_landmarks=True,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
    )

# ══════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════

def main():
    
    ap = argparse.ArgumentParser(description='Incline DB Press Analyzer')
    ap.add_argument('--video',  default=None,      help='Path to video file (default: webcam)')
    ap.add_argument('--mode',   default='beginner', choices=['beginner', 'pro'])
    ap.add_argument('--flip',   action='store_true', help='Mirror the display')
    ap.add_argument('--mute',   action='store_true', help='Disable voice coach')
    ap.add_argument('--speed',  type=int, default=5, help='Speech speed 1-10')
    args = ap.parse_args()
    

    T     = get_thresholds(args.mode)
    voice = VoiceCoach(speed=args.speed, mute=args.mute)
    proc  = InclineDBPressProcessor(T, flip=args.flip, voice=voice)
    print("STEP 1: before make_pose()")
    pose = make_pose()
    print("STEP 2: after make_pose()")
    print("STEP 3: before VideoCapture")
    cap = cv2.VideoCapture(0 if args.video is None else args.video)
    print("STEP 4: after VideoCapture")
    
    if not cap.isOpened():
        print("❌  Cannot open video source.")
        return

    print(f"💪  Incline DB Press Analyzer  [{args.mode.upper()}]")
    print("    Camera: SIDE VIEW at bench/shoulder height   |   Q = quit\n")
    print("  Key Angles (side view):")
    e = T['ELBOW']
    print(f"    Elbow  — TOP  (extended):  {e['TOP'][0]}–{e['TOP'][1]}°")
    print(f"    Elbow  — MID  (transition): {e['MID'][0]}–{e['MID'][1]}°")
    print(f"    Elbow  — BOT  (full stretch): {e['BOT'][0]}–{e['BOT'][1]}°")
    print(f"    Shoulder angle at bottom: {T['SHOULDER_BOT_MIN']}–{T['SHOULDER_BOT_MAX']}°")
    print(f"    Shoulder angle at top:    ≥ {T['SHOULDER_TOP_MIN']}°")
    print(f"    Elbow flare:  {T['FLARE_MIN']}–{T['FLARE_MAX']}° (shoulder→elbow)\n")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            output = proc.process(frame, pose)
            output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
            cv2.imshow('Incline DB Press Analyzer — Q to quit', output)
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
    