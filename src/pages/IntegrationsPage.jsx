import { useState, useRef, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from "recharts";

import { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

export default function IntegrationsPage({ T }) {
  const [connected, setConnected] = useState({});
  const [connecting, setConnecting] = useState(null);
  const [activeTab, setActiveTab] = useState("apps");
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const APPS = [
    { id: "myfitnesspal", name: "MyFitnessPal", icon: "🥗", cat: "Nutrition", desc: "Sync food diary, macros and calorie logs", color: "#00b894" },
    { id: "applehealth", name: "Apple Health", icon: "❤️", cat: "Health", desc: "Pull steps, heart rate, sleep and activity rings", color: "#ff6b6b" },
    { id: "fitbit", name: "Fitbit", icon: "⌚", cat: "Wearable", desc: "Real-time heart rate, steps and sleep stages", color: "#5b7cf5" },
    { id: "garmin", name: "Garmin Connect", icon: "🏃", cat: "Wearable", desc: "Advanced running metrics, VO2 max and training load", color: "#e8a83a" },
    { id: "strava", name: "Strava", icon: "🚴", cat: "Activity", desc: "Import runs, rides and workouts automatically", color: "#e07a35" },
    { id: "googlefit", name: "Google Fit", icon: "🟢", cat: "Health", desc: "Android health data, activity and heart points", color: "#38b4b4" },
    { id: "whoop", name: "WHOOP", icon: "💪", cat: "Recovery", desc: "Recovery score, strain and sleep performance", color: "#00d4aa" },
    { id: "cronometer", name: "Cronometer", icon: "📊", cat: "Nutrition", desc: "Micronutrient tracking and detailed food analysis", color: "#e8a83a" },
  ];

  useEffect(() => {
    fetchIntegrations();
    fetchLogs();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("integrations_data").select("*").eq("user_id", user.id);
      if (data) {
        const map = {};
        data.forEach(row => { map[row.app_id] = row.connected; });
        setConnected(map);
      }
    } catch { }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("sync_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (data) setSyncLogs(data);
    } catch { }
  };

  const handleToggle = async (app) => {
    if (connecting) return;
    setConnecting(app.id);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isCurrentlyConnected = !!connected[app.id];
      const newStatus = !isCurrentlyConnected;

      // Update integrations table
      await supabase.from("integrations_data").upsert([{
        user_id: user.id,
        app_id: app.id,
        connected: newStatus,
        connected_at: newStatus ? new Date().toISOString() : null
      }], { onConflict: "user_id,app_id" });

      // Log event
      const eventDetails = newStatus ? "Authentication successful" : "Disconnected by user";
      const eventType = newStatus ? "App Connected" : "App Disconnected";
      
      await supabase.from("sync_events").insert([{
        user_id: user.id,
        app_id: app.id,
        app_name: app.name,
        app_icon: app.icon,
        event_type: eventType,
        detail: eventDetails,
        ok: true
      }]);

      setConnected(p => ({ ...p, [app.id]: newStatus }));
      fetchLogs(); // refresh logs visually
    } catch (err) {
      console.warn("Integration toggle failed", err);
    } finally {
      setConnecting(null);
    }
  };

  const connectedCount = Object.values(connected).filter(Boolean).length;
  const TABS = [["apps", "📱 Apps"], ["activity", "📋 Sync Log"]];

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: T.txtTert }}>Loading integrations...</div>;

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 40%", height: 130 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,#5b7cf5,#00d4aa)` }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>CONNECT</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Integrations</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Connect apps and wearables · <span style={{ color: "#00d4aa", fontWeight: 600 }}>{connectedCount} active</span></div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 16, border: `1px solid ${T.border}` }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, fontSize: 11, fontWeight: activeTab === id ? 600 : 400, background: activeTab === id ? T.bgActive : "transparent", color: activeTab === id ? T.txtPrim : T.txtSec, border: `1px solid ${activeTab === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      {activeTab === "apps" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {APPS.map((app, i) => {
            const isOn = !!connected[app.id];
            const isBusy = connecting === app.id;
            return (
              <div key={app.id} style={{ background: T.bgCard, border: `1px solid ${isOn ? app.color + "55" : T.border}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden", animation: `fadeUp .4s ease ${i * 0.05}s both` }}>
                {isOn && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: app.color, borderRadius: "10px 10px 0 0" }} />}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${app.color}22`, border: `1px solid ${app.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{app.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>{app.name}</div>
                      <div style={{ fontSize: 9, color: app.color, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginTop: 1 }}>{app.cat}</div>
                    </div>
                  </div>
                  <button onClick={() => handleToggle(app)} disabled={isBusy} style={{ width: 44, height: 24, borderRadius: 12, background: isBusy ? "#555" : isOn ? app.color : "#444", position: "relative", cursor: "pointer", border: "none", transition: "background .25s", flexShrink: 0, boxShadow: isOn ? `0 0 10px ${app.color}44` : "none" }}>
                    {isBusy
                      ? <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "block", animation: "spin .6s linear infinite" }} />
                      : <span style={{ position: "absolute", top: 3, left: isOn ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", display: "block" }} />
                    }
                  </button>
                </div>
                <div style={{ fontSize: 11, color: T.txtTert, lineHeight: 1.6, marginBottom: 8 }}>{app.desc}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: isOn ? app.color : T.txtTert, fontFamily: "DM Mono" }}>{isOn ? "Connected" : "Not connected"}</span>
                  {isOn && <span style={{ fontSize: 9, background: `${app.color}18`, color: app.color, border: `1px solid ${app.color}33`, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>LIVE</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "activity" && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>Recent Sync Events</div>
            <span style={{ fontSize: 10, background: "#00d4aa18", color: "#00d4aa", border: "1px solid #00d4aa33", borderRadius: 4, padding: "2px 8px" }}>Live DB</span>
          </div>
          {syncLogs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: T.txtTert, fontSize: 12 }}>No sync records found. Connected apps will log here.</div>
          ) : (
            syncLogs.map((ev, i) => {
              const d = new Date(ev.created_at);
              const time = d.toLocaleDateString() === new Date().toLocaleDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString();
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 22px 1fr 70px", gap: 12, alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${T.border}44` }}>
                  <div style={{ fontSize: 10, color: T.txtTert, fontFamily: "DM Mono" }}>{time}</div>
                  <div style={{ fontSize: 15 }}>{ev.app_icon || "📱"}</div>
                  <div>
                    <div style={{ fontSize: 12, color: T.txtPrim, fontWeight: 500 }}>{ev.app_name} <span style={{ color: T.txtTert, fontWeight: 400 }}>· {ev.event_type}</span></div>
                    <div style={{ fontSize: 10, color: T.txtTert, marginTop: 2 }}>{ev.detail}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: ev.ok ? "#00d4aa" : "#e05555", background: ev.ok ? "#00d4aa18" : "#e0555518", border: `1px solid ${ev.ok ? "#00d4aa44" : "#e0555544"}`, borderRadius: 4, padding: "2px 7px", textAlign: "center" }}>{ev.ok ? "✓ OK" : "✕ FAIL"}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   AUDIT TRAILS PAGE
════════════════════════════════════════════ */
