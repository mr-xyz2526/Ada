import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

import { useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function ProfilePage({ user, metrics, onUpdate, T }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    goal: user.goal || "",
    activityLevel: user.activityLevel || "",
    workoutType: user.workoutType || "",
    workoutDays: user.workoutDays || 3,
    height: user.height || "",
    weight: user.weight || "",
    gender: user.gender || "Male",
  });

  const bi = metrics ? {
    c: metrics.bmi < 18.5 ? T.yellow : metrics.bmi < 25 ? T.green : metrics.bmi < 30 ? T.orange : T.red,
    l: metrics.bmi < 18.5 ? "Underweight" : metrics.bmi < 25 ? "Normal" : metrics.bmi < 30 ? "Overweight" : "Obese"
  } : { c: T.txtSec, l: "Unknown" };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not logged in");

      const upData = {
        goal: formData.goal,
        fitness_level: formData.activityLevel, // Mapping activity to fitness_level for consistency or keep activityLevel if added
        workout_type: formData.workoutType,
        workout_days: parseInt(formData.workoutDays),
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        last_update: new Date().toISOString()
      };

      await supabase.from("profiles").update(upData).eq("id", authUser.id);
      
      const updatedUser = { 
        ...user, 
        ...formData, 
        workoutDays: parseInt(formData.workoutDays), 
        height: parseFloat(formData.height), 
        weight: parseFloat(formData.weight) 
      };
      
      if (onUpdate) onUpdate(updatedUser);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    color: T.txtPrim,
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 12,
    width: "140px",
    fontFamily: "DM Sans"
  };

  const ARCH = [
    ["Frontend UI", "React (Vite) + Recharts"],
    ["Backend API", "Supabase + Edge Functions"],
    ["Database", "PostgreSQL (RLS Enabled)"],
    ["Real-time Sync", "Supabase Subscriptions"],
  ];

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1549476464-37392f717541?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 35%", height: 130 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.accent},${T.yellow})`, opacity: 0.9 }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.accentLt, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>SETTINGS</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: "-.5px", marginBottom: 3 }}>Profile</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Fitness profile, computed metrics, system reference</div>
        </div>
      </div>

      {/* Editor controls */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        {editing ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ background: "transparent", color: T.txtTert, border: `1px solid ${T.border}`, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: T.accent, color: "#fff", border: "none", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ background: T.bgInput, color: T.txtPrim, border: `1px solid ${T.border}`, padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>✏️ Edit Profile</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Personal Information</div>
          <div style={{ padding: "0 16px" }}>
            {[
              ["Full Name", user.name],
              ["Email", user.email],
              ["Age", user.age + " years"],
              ["Gender", editing ? "select" : user.gender, "gender", ["Male", "Female", "Other"]],
              ["Height", editing ? "number" : user.height + " cm", "height"],
              ["Weight", editing ? "number" : user.weight + " kg", "weight"]
            ].map(([l, v, key, opts]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.border}44`, fontSize: 12 }}>
                <span style={{ color: T.txtSec, width: 100, flexShrink: 0 }}>{l}</span>
                {v === "select" ? (
                  <select style={inputStyle} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : v === "number" ? (
                  <input type="number" style={inputStyle} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} />
                ) : (
                  <span style={{ fontWeight: 500, color: T.txtPrim }}>{v}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Fitness Configuration</div>
          <div style={{ padding: "0 16px" }}>
            {[
              ["Goal", editing ? "select" : user.goal, "goal", ["Fat Loss", "Muscle Gain", "Endurance", "Flexibility"]],
              ["Activity", editing ? "select" : user.activityLevel, "activityLevel", ["Sedentary", "Light", "Moderate", "Active", "Very Active"]],
              ["Workout Type", editing ? "select" : user.workoutType, "workoutType", ["Gym", "Home", "Hybrid", "Calisthenics", "Yoga"]],
              ["Days/Week", editing ? "number" : user.workoutDays, "workoutDays"],
              ["Hrs/Day", user.workoutHours + "h"]
            ].map(([l, v, key, opts]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.border}44`, fontSize: 12 }}>
                <span style={{ color: T.txtSec, width: 100, flexShrink: 0 }}>{l}</span>
                {v === "select" ? (
                  <select style={inputStyle} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : v === "number" ? (
                  <input type="number" style={inputStyle} value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} min={1} max={7} />
                ) : l === "Goal" && !editing ? (
                  <span style={{ fontSize: 9, background: `${T.accent}18`, color: T.accentLt, border: `1px solid ${T.accent}33`, borderRadius: 4, padding: "2px 8px", fontFamily: "DM Mono" }}>{v}</span>
                ) : (
                  <span style={{ fontWeight: 500, color: T.txtPrim }}>{v}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 12 }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>Calculated Metrics</div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {metrics && [
            ["BMI", "" + metrics.bmi, bi.c, bi.l],
            ["TDEE", metrics.tdee + " kcal", T.txtSec, "Maintenance"],
            ["Target Cal", metrics.target + " kcal", T.yellow, "Daily Goal"],
            ["Protein", metrics.prot + "g", T.accentLt, "Daily Protein"]
          ].map(([l, v, c, s]) => (
            <div key={l} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 7, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 10, color: T.txtTert, marginTop: 4 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8 }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 500, color: T.txtPrim }}>System Architecture Reference</div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {ARCH.map(([k, v]) => (
            <div key={k} style={{ background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 12px" }}>
              <div style={{ fontSize: 9, color: T.txtTert, fontFamily: "DM Mono", marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 12, color: T.txtPrim }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



/* ════════════════════════════════════════════
   UPLOAD DATA PAGE
════════════════════════════════════════════ */
