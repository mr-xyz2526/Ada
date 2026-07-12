import { useState, useRef, useEffect, useCallback } from "react";

const EXERCISES = [
  {
    id: "pushup", name: "Push-Ups", icon: "💪", focus: "Chest & Triceps",
    script: "pushup_analyzer.py",
    cameraHint: "SIDE VIEW · camera at chest height · full body visible",
    metrics: ["Elbow angle (shoulder→elbow→wrist)", "Hip deviation (sag/pike)", "Elbow flare angle", "Neck angle"],
    feedbacks: [
      { label: "HIPS SAGGING", color: "#5b7cf5", desc: "Tighten your core" },
      { label: "HIPS PIKING", color: "#5b7cf5", desc: "Lower your butt" },
      { label: "ELBOWS FLARING", color: "#e05555", desc: "Tuck elbows in" },
      { label: "GO LOWER", color: "#e05555", desc: "Full range of motion" },
      { label: "HEAD DROPPING", color: "#e8a83a", desc: "Keep neck neutral" },
    ],
    tips: ["Set camera at SIDE VIEW, chest height — not facing you", "Arms extended = UP · Chest near floor = DOWN", "Valid rep: extend → lower → bottom → push back up", "Tracks hip dev, elbow angle, flare, and neck position"],
    mode: "reps", color: "#5b7cf5", video: "https://www.youtube.com/watch?v=IODxDxX7oi4"
  },
  {
    id: "squat", name: "Squats", icon: "🏋️", focus: "Quads & Glutes",
    script: "squat_analyzer2.py",
    cameraHint: "SIDE VIEW · camera at hip/waist height · full body visible",
    metrics: ["Hip vertical angle", "Knee vertical angle", "Ankle vertical angle", "Torso lean angle"],
    feedbacks: [
      { label: "LEAN BACK", color: "#00b4d8", desc: "Keep torso upright" },
      { label: "LEAN FORWARD", color: "#00b4d8", desc: "Only slight forward lean" },
      { label: "KNEE CAVING", color: "#e05555", desc: "Push knees outward" },
      { label: "TOO SHALLOW", color: "#e8a83a", desc: "Thighs parallel to floor" },
      { label: "TOO DEEP", color: "#e8a83a", desc: "Control your depth" },
    ],
    tips: ["Stand SIDEWAYS to camera, full body visible", "Aim for thighs parallel at the bottom", "Knees track over toes — never cave inward", "Voice counts each rep and coaches every phase"],
    mode: "reps", color: "#00b894", video: "https://www.youtube.com/watch?v=SW_C1A-rejs"
  },
  {
    id: "plank", name: "Plank", icon: "🧘", focus: "Core & Stability",
    script: "plank_analyzer.py",
    cameraHint: "SIDE VIEW · camera at hip height · full body in frame",
    metrics: ["Body line angle (shoulder→hip→ankle)", "Neck angle (ear→shoulder→hip)", "Shoulder collapse distance"],
    feedbacks: [
      { label: "HIPS SAGGING", color: "#e07a35", desc: "Squeeze your core" },
      { label: "HIPS PIKING", color: "#e07a35", desc: "Lower your hips" },
      { label: "HEAD DROPPING", color: "#9b59b6", desc: "Look slightly forward" },
      { label: "NECK CRANING", color: "#9b59b6", desc: "Look slightly downward" },
      { label: "SHOULDERS COLLAPSING", color: "#00b4d8", desc: "Push the floor away" },
    ],
    tips: ["Camera SIDE VIEW at hip height", "Squeeze glutes, quads and abs together", "Keep neck neutral — eyes slightly ahead of hands", "Timer pauses automatically when form breaks"],
    mode: "timer", color: "#e07a35", video: "https://www.youtube.com/watch?v=pSHjTRCQxIw"
  },
  {
    id: "deadlift", name: "Deadlift", icon: "🏗️", focus: "Posterior Chain",
    script: "deadlift_analyzer.py",
    cameraHint: "SIDE VIEW · camera at hip/waist height · full body visible",
    metrics: ["Hip hinge angle (shoulder→hip vertical)", "Upper back rounding (ear→shoulder→hip)", "Bar path (wrist vs shin line)", "Lockout angle"],
    feedbacks: [
      { label: "UPPER BACK ROUNDING", color: "#e05555", desc: "Chest up, pull shoulder blades back" },
      { label: "LOWER BACK ROUNDING", color: "#e05555", desc: "Brace core, neutral spine" },
      { label: "BAR DRIFTING", color: "#e8a83a", desc: "Keep bar close to shins" },
      { label: "HIPS SHOOTING UP", color: "#5b7cf5", desc: "Drive legs and hips together" },
      { label: "NO LOCKOUT", color: "#00b894", desc: "Fully extend hips at top" },
    ],
    tips: ["SIDE VIEW camera at hip height", "Hinge at hips — don't squat the weight", "Keep bar path vertical, close to your legs", "Drive legs into floor, then extend hips"],
    mode: "reps", color: "#e05555", video: "https://www.youtube.com/watch?v=Xs3mzCZCiz0"
  },
  {
    id: "lunge", name: "Lunges", icon: "🦵", focus: "Quads, Glutes & Balance",
    script: "lunge_analyzer.py",
    cameraHint: "SIDE VIEW · camera at hip height · step forward in-line",
    metrics: ["Front knee angle", "Back knee angle", "Torso lean angle", "Depth (back knee to floor)"],
    feedbacks: [
      { label: "FRONT KNEE CAVING", color: "#e05555", desc: "Push knee outward" },
      { label: "LEAN FORWARD", color: "#5b7cf5", desc: "Keep torso upright" },
      { label: "TOO SHALLOW", color: "#e8a83a", desc: "Back knee near the floor" },
      { label: "OVER BENDING", color: "#e8a83a", desc: "Control front knee depth" },
    ],
    tips: ["Stand SIDEWAYS to camera, full body visible", "Step forward — back knee drops toward floor", "Keep torso upright — don't lean forward", "Front knee tracks over second toe"],
    mode: "reps", color: "#9b59b6", video: "https://www.youtube.com/watch?v=L8fyj8vcaDk"
  },
  {
    id: "shoulder", name: "Shoulder Press", icon: "🙌", focus: "Shoulders & Triceps",
    script: "shoulder_analyzer.py",
    cameraHint: "SIDE VIEW · camera at shoulder height · full body in frame",
    metrics: ["Elbow angle (shoulder→elbow→wrist)", "Wrist vs shoulder alignment", "Lumbar angle (hip thrust)", "Head forward position"],
    feedbacks: [
      { label: "LUMBAR HYPEREXTENSION", color: "#e05555", desc: "Brace core, don't arch back" },
      { label: "TRUNK LEAN", color: "#e05555", desc: "Stay vertical throughout" },
      { label: "WRIST DRIFT", color: "#e8a83a", desc: "Keep wrists over shoulders" },
      { label: "FORWARD HEAD", color: "#9b59b6", desc: "Chin back as bar passes" },
      { label: "INCOMPLETE LOCKOUT", color: "#00b894", desc: "Fully extend at the top" },
    ],
    tips: ["SIDE VIEW camera at shoulder height", "Bar path vertical over shoulder joint", "Brace core — don't arch lower back", "Chin slightly back as bar passes your face"],
    mode: "reps", color: "#00d4aa", video: "https://www.youtube.com/watch?v=qEwKCR5JCog"
  },
];

export default function ARTrainer({ user, T, initialExId = null, onClearEx = () => {} }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(() => {
    if (initialExId) {
      const found = EXERCISES.find(e => e.id === initialExId);
      if (found) return found;
    }
    return EXERCISES[0];
  });
  const [cameraError, setCameraError] = useState(null);
  const [tab, setTab] = useState("how");
  const [permState, setPermState] = useState("idle");

  useEffect(() => {
    if (initialExId) {
      const found = EXERCISES.find(e => e.id === initialExId);
      if (found) {
        setSelected(found);
        onClearEx(); // Reset so it doesn't force select again if user switches manually later
      }
    }
  }, [initialExId, onClearEx]);

  const startCamera = async () => {
    setCameraError(null);
    setPermState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setPermState("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.warn("play error:", e));
        };
      }
      setActive(true);
    } catch (err) {
      setPermState("denied");
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera blocked. Click the 🔒 icon in your browser address bar → allow camera → try again.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found. Please connect a camera and try again.");
      } else if (err.name === "NotReadableError") {
        setCameraError("Camera is in use by another app. Close it and retry.");
      } else {
        setCameraError("Camera error: " + err.message);
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setPermState("idle");
  }, []);

  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); }, []);

  const selectExercise = (ex) => { if (active) stopCamera(); setSelected(ex); setTab("how"); setCameraError(null); };

  // Group exercises for the sidebar
  const groups = [
    { label: "PUSH", exs: ["pushup", "shoulder"] },
    { label: "LOWER BODY", exs: ["squat", "lunge"] },
    { label: "PULL & CORE", exs: ["deadlift", "plank"] },
  ];

  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      {/* Hero */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1544033527-b192daee1f5b?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center", height: 120 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.4))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${selected.color},#00d4aa)`, transition: "all .3s" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>AI FORM ANALYSIS · 6 EXERCISES</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 4 }}>AR Trainer</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>MediaPipe pose detection · {selected.name} · {selected.mode === "reps" ? "Rep counter" : "Hold timer"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        {/* LEFT — camera + info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Camera viewport */}
          <div style={{ background: "#0a0a0a", borderRadius: 12, position: "relative", height: 440, overflow: "hidden", border: `2px solid ${active ? selected.color : T.border}`, transition: "border-color .3s" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: active ? "block" : "none" }} />

            {!active && (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
                <div style={{ fontSize: 60 }}>{selected.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
                  📐 {selected.cameraHint}
                </div>
                {cameraError && (
                  <div style={{ background: "rgba(224,85,85,0.12)", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8, padding: "10px 18px", fontSize: 12, color: "#e05555", textAlign: "center", maxWidth: 320, lineHeight: 1.6 }}>
                    {cameraError}
                  </div>
                )}
                <button onClick={startCamera} disabled={permState === "requesting"}
                  style={{ background: permState === "requesting" ? "rgba(255,255,255,0.08)" : selected.color, color: "#fff", border: "none", padding: "12px 40px", borderRadius: 24, fontWeight: 700, cursor: permState === "requesting" ? "wait" : "pointer", fontFamily: "DM Sans", fontSize: 14, display: "flex", alignItems: "center", gap: 8, transition: "all .2s" }}>
                  {permState === "requesting"
                    ? <><span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Requesting…</>
                    : "📷 Activate Camera"}
                </button>
              </div>
            )}

            {active && (
              <>
                <div style={{ position: "absolute", inset: 16, border: `2px dashed ${selected.color}55`, borderRadius: 10, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(0,0,0,0.78)", padding: "6px 12px", borderRadius: 7, backdropFilter: "blur(8px)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: selected.color, letterSpacing: ".1em", textTransform: "uppercase" }}>● LIVE</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginTop: 2 }}>{selected.name.toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{selected.mode === "reps" ? "Rep Counter" : "Hold Timer"}</div>
                </div>
                <div style={{ position: "absolute", bottom: 20, left: 20, background: "rgba(0,0,0,0.65)", padding: "5px 10px", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>📐 {selected.cameraHint}</div>
                </div>
                <button onClick={stopCamera} style={{ position: "absolute", top: 16, right: 16, background: "rgba(224,85,85,0.85)", color: "#fff", border: "none", width: 34, height: 34, borderRadius: "50%", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>✕</button>
              </>
            )}
          </div>

          {/* Info tabs */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.bgInput }}>
              {[["how", "📋 How to Use"], ["metrics", "📐 Tracked Angles"], ["feedback", "⚠️ Form Cues"]].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0", fontSize: 11, fontWeight: tab === id ? 700 : 400, color: tab === id ? selected.color : T.txtSec, background: "transparent", border: "none", cursor: "pointer", borderBottom: `2px solid ${tab === id ? selected.color : "transparent"}`, transition: "all .15s", fontFamily: "DM Sans" }}>{label}</button>
              ))}
            </div>
            <div style={{ padding: "14px 16px" }}>
              {tab === "how" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {selected.tips.map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${selected.color}20`, color: selected.color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 12, color: T.txtSec, lineHeight: 1.6 }}>{tip}</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, padding: "10px 12px", background: `${T.bgInput}`, border: `1px solid ${T.border}`, borderRadius: 7, lineHeight: 1.8 }}>
                    <div style={{ fontSize: 10, color: T.txtTert, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Run locally with full pose overlay</div>
                    <code style={{ fontSize: 11, color: T.accentLt, fontFamily: "DM Mono, monospace", display: "block" }}>cd ar_analyzers</code>
                    <code style={{ fontSize: 11, color: T.accentLt, fontFamily: "DM Mono, monospace", display: "block" }}>python run_ar.py {selected.id}</code>
                    <div style={{ fontSize: 10, color: T.txtTert, marginTop: 4 }}>or: <code style={{ color: T.txtSec, fontFamily: "DM Mono, monospace" }}>python {selected.script}</code></div>
                  </div>

                  {selected.video && (
                    <a href={selected.video} target="_blank" rel="noreferrer" 
                      style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px", background: `${selected.color}14`, border: `1px solid ${selected.color}33`, borderRadius: 8, color: selected.color, fontSize: 13, fontWeight: 700, textDecoration: "none", transition: "all .2s" }}>
                      📺 Watch Tutorial Video
                    </a>
                  )}
                </div>
              )}
              {tab === "metrics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: T.txtTert, marginBottom: 2 }}>Angles tracked in real-time by MediaPipe:</div>
                  {selected.metrics.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.bgInput, borderRadius: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, color: T.txtPrim, fontWeight: 500 }}>{m}</div>
                    </div>
                  ))}
                </div>
              )}
              {tab === "feedback" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: T.txtTert, marginBottom: 2 }}>Voice + on-screen cues:</div>
                  {selected.feedbacks.map((fb, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: `${fb.color}12`, border: `1px solid ${fb.color}30` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: fb.color, minWidth: 160, flexShrink: 0 }}>{fb.label}</div>
                      <div style={{ fontSize: 11, color: T.txtSec }}>→ {fb.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — exercise selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.txtTert, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>{group.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {EXERCISES.filter(ex => group.exs.includes(ex.id)).map(ex => (
                  <div key={ex.id} onClick={() => selectExercise(ex)}
                    style={{ background: selected.id === ex.id ? `${ex.color}14` : T.bgCard, border: `1px solid ${selected.id === ex.id ? ex.color : T.border}`, borderRadius: 9, padding: "11px 14px", cursor: "pointer", transition: "all .18s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 20 }}>{ex.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: selected.id === ex.id ? ex.color : T.txtPrim, lineHeight: 1.2 }}>{ex.name}</div>
                        <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>{ex.focus}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${ex.color}20`, color: ex.color, flexShrink: 0 }}>
                        {ex.mode === "reps" ? "REPS" : "TIMER"}
                      </span>
                    </div>
                    {selected.id === ex.id && (
                      <div style={{ marginTop: 8, fontSize: 10, color: T.txtTert, padding: "5px 8px", background: T.bgInput, borderRadius: 5 }}>📐 {ex.cameraHint}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Camera tips */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.txtPrim, marginBottom: 10 }}>💡 Camera Tips</div>
            {[
              ["Good lighting", "Bright room so MediaPipe can detect your pose"],
              ["Full body in frame", "Step back so head-to-toe is visible"],
              ["Stable surface", "Rest device on stable surface — not handheld"],
              ["Side view", "Most exercises need you sideways to camera"],
            ].map(([title, desc], i) => (
              <div key={i} style={{ marginBottom: i < 3 ? 9 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: selected.color, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: T.txtTert, lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
