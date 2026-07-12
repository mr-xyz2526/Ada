import { useState } from "react";
import { supabase } from "../utils/supabaseClient";

export default function HealthPage({ reports, onUpdate, T }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ issue_type: "General", description: "", severity: "Low" });

  const ISSUE_TYPES = ["Knee", "Shoulder", "Back", "Hip", "Wrist", "Ankle", "Neck", "General"];
  const SEVERITIES = ["Low", "Medium", "High"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase.from('health_reports').insert([{
        user_id: user.id,
        issue_type: form.issue_type,
        description: form.description,
        severity: form.severity,
        status: "Active"
      }]).select();

      if (error) throw error;
      onUpdate();
      setForm({ issue_type: "General", description: "", severity: "Low" });
    } catch (err) {
      console.error("Error posting health report:", err.message);
      alert("Failed to post report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveIssue = async (id) => {
    try {
      const { error } = await supabase
        .from('health_reports')
        .update({ status: "Resolved" })
        .eq('id', id);
      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error("Error resolving issue:", err.message);
    }
  };

  const activeReports = reports.filter(r => r.status === "Active");
  const resolvedReports = reports.filter(r => r.status === "Resolved");

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center", height: 130
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${T.red},${T.orange})` }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.red, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>SAFETY & CARE</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 3 }}>Health & Injuries</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Log issues to auto-adjust your training plan and avoid further injury.</div>
        </div>
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Report Form */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.txtPrim, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>📝</span> Post New Report
          </h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.txtSec, marginBottom: 6, display: "block" }}>Issue Area</label>
              <select value={form.issue_type} onChange={e => setForm({ ...form, issue_type: e.target.value })} style={{ width: "100%" }}>
                {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.txtSec, marginBottom: 6, display: "block" }}>Severity</label>
              <div style={{ display: "flex", gap: 8 }}>
                {SEVERITIES.map(s => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, severity: s })} style={{
                    flex: 1, padding: "8px", borderRadius: 6, fontSize: 11, fontWeight: 500, border: `1px solid ${form.severity === s ? T.accent : T.border}`,
                    background: form.severity === s ? `${T.accent}22` : T.bgInput, color: form.severity === s ? T.accent : T.txtSec, transition: "all .2s"
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: T.txtSec, marginBottom: 6, display: "block" }}>Description / Notes</label>
              <textarea placeholder="e.g. Sharp pain in left knee during squats..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ width: "100%", height: 80, resize: "none" }} />
            </div>
            <button type="submit" disabled={loading} style={{
              marginTop: 6, padding: "10px", borderRadius: 6, background: T.red, color: "#fff", border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: loading ? 0.6 : 1
            }}>
              {loading ? "Posting..." : "Submit Report"}
            </button>
          </form>
        </div>

        {/* Status Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Active Issues */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, minHeight: 140 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: T.txtPrim, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: T.red }}>●</span> Active Issues
            </h3>
            {activeReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: T.txtTert, fontSize: 12 }}>
                No active injuries. Stay safe! 🦾
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeReports.map(r => (
                  <div key={r.id} style={{ background: T.bgInput, borderLeft: `3px solid ${r.severity === "High" ? T.red : r.severity === "Medium" ? T.orange : T.yellow}`, borderRadius: 6, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.txtPrim }}>{r.issue_type} Issues</div>
                      <span style={{ fontSize: 9, fontWeight: 700, background: `${r.severity === "High" ? T.red : r.severity === "Medium" ? T.orange : T.yellow}22`, color: r.severity === "High" ? T.red : r.severity === "Medium" ? T.orange : T.yellow, padding: "2px 6px", borderRadius: 4 }}>{r.severity.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.txtSec, marginBottom: 8, lineHeight: 1.4 }}>{r.description || "No description provided."}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 9, color: T.txtTert }}>{new Date(r.created_at).toLocaleDateString()}</span>
                      <button onClick={() => resolveIssue(r.id)} style={{ padding: "4px 10px", borderRadius: 4, background: T.green + "22", border: `1px solid ${T.green}44`, color: T.green, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Mark Resolved</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Impact Alert */}
          {activeReports.length > 0 && (
            <div style={{ background: `${T.red}10`, border: `1px solid ${T.red}33`, borderRadius: 8, padding: 16, animation: "pulse 2s infinite" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 4 }}>⚠️ System Notice</div>
              <div style={{ fontSize: 11, color: T.txtSec, lineHeight: 1.5 }}>
                Your workout plans are currently filtering out exercises that affect: 
                <span style={{ fontWeight: 700, color: T.txtPrim, marginLeft: 4 }}>{activeReports.map(r => r.issue_type).join(", ")}</span>.
                Regenerate your plan to apply these changes.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
