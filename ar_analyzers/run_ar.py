#!/usr/bin/env python3
"""
AdaptFit AR Trainer — Universal Launcher
=========================================
Run this script to pick and launch any exercise analyzer.

Usage:
    python run_ar.py                  # interactive menu
    python run_ar.py pushup           # launch pushup directly
    python run_ar.py squat --mode pro
    python run_ar.py deadlift --flip --mute
    python run_ar.py shoulder --seated
    python run_ar.py plank
    python run_ar.py lunge

All exercises support:
    --mode pro      stricter thresholds
    --flip          mirror webcam horizontally
    --mute          disable voice coaching
    --speed 1-10    voice speed (default 5)
    --video FILE    analyse a video file instead of webcam
"""

import sys
import os
import subprocess

EXERCISES = {
    "pushup":   ("pushup_analyzer.py",   "Push-Ups",       "Chest & Triceps",    "REPS"),
    "squat":    ("squat_analyzer2.py",   "Squats",         "Quads & Glutes",     "REPS"),
    "plank":    ("plank_analyzer.py",    "Plank",          "Core & Stability",   "TIMER"),
    "deadlift": ("deadlift_analyzer.py", "Deadlift",       "Posterior Chain",    "REPS"),
    "lunge":    ("lunge_analyzer.py",    "Lunges",         "Quads & Balance",    "REPS"),
    "shoulder": ("shoulder_analyzer.py", "Shoulder Press", "Shoulders & Triceps","REPS"),
}

def check_deps():
    missing = []
    for pkg, import_name in [("opencv-python","cv2"), ("mediapipe","mediapipe"), ("numpy","numpy")]:
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"\n❌  Missing packages: {', '.join(missing)}")
        print(f"   Run:  pip install -r requirements.txt\n")
        sys.exit(1)

def interactive_menu():
    print("\n" + "═"*52)
    print("   AdaptFit AR Trainer — Exercise Selector")
    print("═"*52)
    items = list(EXERCISES.items())
    for i, (key, (_, name, focus, mode)) in enumerate(items, 1):
        print(f"  [{i}]  {name:<20} {focus:<22} {mode}")
    print("═"*52)
    
    while True:
        try:
            choice = input("\nSelect exercise (1-6) or q to quit: ").strip()
            if choice.lower() == 'q':
                sys.exit(0)
            idx = int(choice) - 1
            if 0 <= idx < len(items):
                return items[idx][0]  # return exercise key
            print("   Invalid choice. Enter 1-6.")
        except (ValueError, KeyboardInterrupt):
            sys.exit(0)

def main():
    check_deps()
    
    # Determine exercise
    args = sys.argv[1:]
    extra_args = []
    exercise_key = None
    
    if args and args[0] in EXERCISES:
        exercise_key = args[0]
        extra_args = args[1:]
    elif args and args[0].startswith('--'):
        # Flags only, no exercise — show menu
        extra_args = args
        exercise_key = interactive_menu()
    else:
        exercise_key = interactive_menu()
    
    script, name, focus, mode = EXERCISES[exercise_key]
    script_path = os.path.join(os.path.dirname(__file__), script)
    
    print(f"\n🎯  Launching: {name}  ({focus})  [{mode}]")
    print(f"    Camera: SIDE VIEW, full body visible")
    print(f"    Press Q to quit\n")
    
    cmd = [sys.executable, script_path] + extra_args
    try:
        subprocess.run(cmd)
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    main()
