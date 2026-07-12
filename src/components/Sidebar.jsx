import { useState } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "" },
  { id: "upload", label: "Upload Data", icon: "" },
  { id: "diet", label: "Diet Plan", icon: "" },
  { id: "workout", label: "Workout", icon: "" },
  { id: "explorer", label: "Plan Explorer", icon: "" },
  { id: "audit", label: "Audit Trails", icon: "" },
  { id: "risk", label: "Vendor Risk", icon: "" },
  { id: "chatbot", label: "AI Assistant", icon: "" },
  { id: "integrations", label: "Integrations", icon: "" },
  { id: "leaderboard", label: "Leaderboard", icon: "" },
];

function Sidebar({ active, onNav, user, isDark, onToggleTheme, T }) {
  return (
    <div style={{ width: 210, minWidth: 210, background: T.bgSidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh", userSelect: "none", transition: "background .3s,border .3s" }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg,${T.accent},#00d4aa)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "glowPulse 2.5s ease-in-out infinite", padding: 7 }}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
            <rect x="1" y="10" width="3" height="4" rx="1" fill="white" />
            <rect x="4" y="8" width="2" height="8" rx="1" fill="white" />
            <rect x="6" y="10.5" width="12" height="3" rx="1" fill="white" />
            <rect x="18" y="8" width="2" height="8" rx="1" fill="white" />
            <rect x="20" y="10" width="3" height="4" rx="1" fill="white" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.txtPrim, lineHeight: 1.2 }}>AdaptFit</div>
          <div style={{ fontSize: 9, color: T.txtTert, marginTop: 2, letterSpacing: ".04em" }}>AI Fitness Platform</div>
        </div>
      </div>

      <div style={{ padding: "14px 16px 6px", fontSize: 9, fontWeight: 600, color: T.txtTert, letterSpacing: ".1em", textTransform: "uppercase" }}>Navigation</div>

      <div style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
        {NAV_ITEMS.map((n, idx) => {
          const isAct = active === n.id;
          return (
            <div key={n.id} className={`nav-item${isAct ? " active" : ""}`} onClick={() => onNav(n.id)} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: 6, marginBottom: 1,
              cursor: "pointer",
              background: isAct ? T.bgActive : "transparent",
              color: isAct ? T.accent : T.txtSec,
              fontSize: 12, fontWeight: isAct ? 600 : 400,
              border: `1px solid ${isAct ? T.borderAct : "transparent"}`,
              animation: `slideInNav .35s ease ${idx * 0.045}s both`,
              transition: "all .15s",
            }}>
              <span style={{ fontSize: 13, opacity: .85, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ color: isAct ? T.txtPrim : T.txtSec }}>{n.label}</span>
              {n.id === "chatbot" && <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 700, background: T.accent, color: "#fff", borderRadius: 3, padding: "1px 5px", letterSpacing: ".05em", animation: "blink 2s ease-in-out infinite" }}>AI</span>}
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 8px 6px" }}>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} T={T} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bgActive, borderRadius: 6, marginTop: 4, border: `1px solid ${T.border}` }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg,${T.accent}99,#00d4aa99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {user?.name?.charAt(0) || "U"}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.txtPrim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "Admin"}</div>
            <div style={{ fontSize: 9, color: T.txtTert, fontFamily: "DM Mono", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email?.slice(0, 18) || "user@adaptfit.ai"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", color: T.txtSec, fontSize: 12, cursor: "pointer", marginTop: 2 }}>
          <span>↩</span> Logout
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   NOTIFICATION BANNER
════════════════════════════════════════════ */