import os
import sys
import cv2
import time
import threading
import importlib
import numpy as np
import mediapipe as mp
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

# Add ar_analyzers directory to sys.path so we can import modules from it
ANALYZERS_DIR = os.path.join(os.getcwd(), 'ar_analyzers')
if ANALYZERS_DIR not in sys.path:
    sys.path.append(ANALYZERS_DIR)

app = Flask(__name__)
CORS(app)

# --- Configuration Mapping ---
# Maps exercise ID to (module_name, class_name)
EXERCISE_MAP = {
    "pushup":           ("pushup_analyzer", "PushupProcessor"),
    "squat":            ("squat_analyzer2", "SquatProcessor"),
    "plank":            ("plank_analyzer", "PlankProcessor"),
    "lunge":            ("lunge_analyzer", "LungeProcessor"),
    "bench-press":      ("bench_press_analyzer", "BenchPressProcessor"),
    "deadlift":         ("deadlift_analyzer", "DeadliftProcessor"),
    "shoulder-press":   ("shoulder_analyzer", "ShoulderProcessor"),
    "barbell-curl":     ("barbell_curl_analyzer", "BarbellCurlProcessor"),
    "cable-fly":        ("cable_fly_analyzer", "CableFlyProcessor"),
    "tricep-pushdown":  ("tricep_pushdown_analyzer", "TricepPushdownProcessor"),
    "chest-dips":       ("chest_dips_analyzer", "ChestDipsProcessor"),
    "incline-db-press": ("incline_db_press_analyzer", "InclineDBPressProcessor")
}

class ARSession:
    def __init__(self):
        self.active_id = None
        self.processor = None
        self.voice = None
        self.pose = None
        self.cap = None
        self.running = False
        self.lock = threading.Lock()
        self.current_frame = None

    def stop(self):
        with self.lock:
            self.running = False
            if self.cap:
                self.cap.release()
                self.cap = None
            if self.voice:
                try:
                    self.voice.stop()
                except:
                    pass
                self.voice = None
            if self.pose:
                try:
                    self.pose.close()
                except:
                    pass
                self.pose = None
            self.processor = None
            self.active_id = None
            self.current_frame = None

    def start(self, exercise_id, mode='beginner', speed=5, mute=False):
        self.stop() # Ensure previous is stopped
        
        if exercise_id not in EXERCISE_MAP:
            return False, f"Exercise {exercise_id} not supported"

        mod_name, class_name = EXERCISE_MAP[exercise_id]
        
        try:
            # Load or reload module
            if mod_name in sys.modules:
                module = importlib.reload(sys.modules[mod_name])
            else:
                module = importlib.import_module(mod_name)
            
            # Instantiate Thresholds, VoiceCoach, and Processor
            T = module.get_thresholds(mode)
            voice_class = getattr(module, 'VoiceCoach')
            self.voice = voice_class(speed=speed, mute=mute)
            
            proc_class = getattr(module, class_name)
            self.processor = proc_class(T, flip=True, voice=self.voice)
            
            # Setup MediaPipe
            mp_pose = mp.solutions.pose
            self.pose = mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                smooth_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                return False, "Could not open camera"
            
            self.active_id = exercise_id
            self.running = True
            
            # Start background capture thread
            threading.Thread(target=self._capture_loop, daemon=True).start()
            
            return True, "Started"
        except Exception as e:
            self.stop()
            return False, str(e)

    def _capture_loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            
            # Process frame
            try:
                # Most processors expect RGB
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                output = self.processor.process(rgb, self.pose)
                # Convert back to BGR for encoding
                bgr = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)
                
                with self.lock:
                    ret, buffer = cv2.imencode('.jpg', bgr)
                    self.current_frame = buffer.tobytes()
            except Exception as e:
                print(f"Error in capture loop: {e}")
                
            time.sleep(0.01)

session = ARSession()

@app.route('/status')
def get_status():
    return jsonify({
        "active": session.active_id,
        "running": session.running
    })

@app.route('/start/<exercise_id>', methods=['POST'])
def start_exercise(exercise_id):
    data = request.json or {}
    mode = data.get('mode', 'beginner')
    speed = data.get('speed', 5)
    mute = data.get('mute', False)
    
    success, msg = session.start(exercise_id, mode, speed, mute)
    return jsonify({"success": success, "message": msg})

@app.route('/stop', methods=['POST'])
def stop_exercise():
    session.stop()
    return jsonify({"success": True, "message": "Stopped"})

def generate_frames():
    while True:
        if not session.running or session.current_frame is None:
            # Placeholder or wait
            time.sleep(0.1)
            continue
            
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + session.current_frame + b'\r\n')
        time.sleep(0.03) # ~30 FPS

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    print("AR Bridge Server starting on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, threaded=True)
