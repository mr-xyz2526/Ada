import { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

export default function LeaderboardPage({ user: currentUser, T }) {
  const [filter, setFilter] = useState("overall");
  const [hoverId, setHoverId] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard_stats')
        .select(`
          id, user_id, workout_streak, diet_streak, total_days, workout_done, diet_done, tier, badge, 
          profiles (name, goal, weight)
        `);
      
      if (error) throw error;

      if (data) {
        const fallbackAvatars = ["💪", "🧘", "🏃", "🤸", "🏋️", "🧗", "🚴", "🤾", "🤼", "🏊"];
        const fallbackCities = ["Mumbai", "Delhi", "Bangalore", "Pune", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Surat", "Jaipur"];
        
        const mappedUsers = data.map((d, i) => {
          let name = d.profiles?.name || "Anonymous User";
          let isMe = d.user_id === currentUser?.id;
          if (isMe && currentUser) name = currentUser.name;

          return {
            id: d.id,
            user_id: d.user_id,
            name: name,
            avatar: fallbackAvatars[i % fallbackAvatars.length],
            city: fallbackCities[i % fallbackCities.length],
            goal: d.profiles?.goal || "Fitness",
            workoutStreak: d.workout_streak || 0,
            dietStreak: d.diet_streak || 0,
            totalDays: d.total_days || 1, // avoid div zero
            workoutDone: d.workout_done || 0,
            dietDone: d.diet_done || 0,
            weight: d.profiles?.weight || 0,
            badge: d.badge || "🥉",
            tier: d.tier || "Bronze",
            isMe
          };
        });
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const scored = users.map(u => ({
    ...u,
    overallStreak: Math.round((u.workoutStreak + u.dietStreak) / 2),
    compliance: Math.round(((u.workoutDone + u.dietDone) / (Math.max(u.totalDays, 1) * 2)) * 100),
    perfectDays: Math.min(u.workoutDone, u.dietDone),
  }));

  const sorted = [...scored].sort((a, b) => {
    if (filter === "workout") return b.workoutStreak - a.workoutStreak;
    if (filter === "diet") return b.dietStreak - a.dietStreak;
    if (filter === "perfect") return b.perfectDays - a.perfectDays;
    return b.overallStreak - a.overallStreak;
  });

  const tierColor = { Diamond: "#00d4aa", Gold: "#e8a83a", Silver: "#b0b8c8", Bronze: "#cd7f32" };
  const tierBg = { Diamond: "#00d4aa15", Gold: "#e8a83a15", Silver: "#b0b8c815", Bronze: "#cd7f3215" };
  const rankMedal = ["🥇", "🥈", "🥉"];
  const me = scored.find(u => u.isMe);
  const myRank = me ? sorted.findIndex(u => u.isMe) + 1 : "-";

  const statVal = (u) => {
    if (filter === "workout") return { v: u.workoutStreak + "d", l: "Workout Streak" };
    if (filter === "diet") return { v: u.dietStreak + "d", l: "Diet Streak" };
    if (filter === "perfect") return { v: u.perfectDays + "d", l: "Perfect Days" };
    return { v: u.overallStreak + "d", l: "Overall Streak" };
  };

  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: T.txtTert }}>Loading leaderboard...</div>;

  return (
    <div style={{ animation: "fadeUp .3s ease" }}>
      {/* Hero Banner */}
      <div style={{
        position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20,
        backgroundImage: "url('https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80')",
        backgroundSize: "cover", backgroundPosition: "center 30%", height: 140
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.88),rgba(0,0,0,0.45) 70%,rgba(0,0,0,0.1))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#e8a83a,#00d4aa)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#e8a83a", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>COMMUNITY</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 4 }}>🏆 Leaderboard</h1>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>Streak rankings across <span style={{ color: "#00d4aa", fontWeight: 600 }}>{users.length} members</span> · Updated daily</div>
          </div>
          {/* My rank card */}
          {me && (
            <div style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "14px 20px", backdropFilter: "blur(10px)", textAlign: "center", minWidth: 110 }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Your Rank</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#e8a83a", lineHeight: 1 }}>#{myRank}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{me?.overallStreak}d streak</div>
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 2, background: T.bgCard, borderRadius: 8, padding: 4, marginBottom: 20, border: `1px solid ${T.border}` }}>
        {[["overall", "🏆 Overall"], ["workout", "🏋️ Workout"], ["diet", "🥗 Diet"], ["perfect", "⭐ Perfect Days"]].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ flex: 1, padding: "8px 10px", borderRadius: 6, fontSize: 11, fontWeight: filter === id ? 600 : 400, background: filter === id ? T.bgActive : "transparent", color: filter === id ? T.txtPrim : T.txtSec, border: `1px solid ${filter === id ? T.borderAct : "transparent"}`, cursor: "pointer", fontFamily: "DM Sans", transition: "all .15s" }}>{label}</button>
        ))}
      </div>

      {/* Podium — top 3 */}
      {sorted.length >= 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
          {[topThree[1], topThree[0], topThree[2]].map((u, i) => {
            if (!u) return <div key={i} />;
            const podiumRank = [2, 1, 3][i];
            const heights = ["160px", "190px", "145px"];
            const sv = statVal(u);
            const isMe = u.isMe;
            return (
              <div key={u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: `fadeUp .5s ease ${i * 0.1}s both` }}>
                {/* Crown for #1 */}
                {podiumRank === 1 && <div style={{ fontSize: 24, marginBottom: 4, animation: "floatUp 3s ease-in-out infinite" }}>👑</div>}
                {/* Avatar bubble */}
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg,${tierColor[u.tier]},${tierColor[u.tier]}88)`, border: `3px solid ${tierColor[u.tier]}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8, boxShadow: `0 0 20px ${tierColor[u.tier]}55`, position: "relative" }}>
                  {u.avatar}
                  {isMe && <div style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: "#5b7cf5", border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>ME</div>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.txtPrim, marginBottom: 2, textAlign: "center" }}>{u.name.split(" ")[0]}</div>
                <div style={{ fontSize: 9, color: T.txtTert, marginBottom: 8, textAlign: "center" }}>{u.city}</div>
                {/* Podium block */}
                <div style={{ width: "100%", height: heights[i], background: `linear-gradient(180deg,${tierColor[u.tier]}33,${tierColor[u.tier]}11)`, border: `1px solid ${tierColor[u.tier]}55`, borderRadius: "8px 8px 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <div style={{ fontSize: 24 }}>{rankMedal[podiumRank - 1]}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: tierColor[u.tier] }}>{sv.v}</div>
                  <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{sv.l}</div>
                  <div style={{ fontSize: 9, background: `${tierColor[u.tier]}22`, color: tierColor[u.tier], border: `1px solid ${tierColor[u.tier]}44`, borderRadius: 4, padding: "2px 8px", fontWeight: 600, marginTop: 2 }}>{u.tier}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats summary strip */}
      {sorted.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            ["Longest Streak", sorted[0]?.overallStreak + "d", sorted[0]?.name.split(" ")[0], "#e8a83a"],
            ["Avg Compliance", Math.round(scored.reduce((a, u) => a + u.compliance, 0) / scored.length) + "%", "across all", "#4db882"],
            ["Perfect Day Record", Math.max(...scored.map(u => u.perfectDays)) + "d", scored.sort((a, b) => b.perfectDays - a.perfectDays)[0]?.name.split(" ")[0], "#00d4aa"],
            ["Active Members", users.length, "this month", "#5b7cf5"],
          ].map(([l, v, sub, c]) => (
            <div key={l} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1, marginBottom: 3 }}>{v}</div>
              <div style={{ fontSize: 10, color: T.txtTert, marginBottom: 2 }}>{sub}</div>
              <div style={{ fontSize: 9, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Full rankings table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "44px 1fr 90px 90px 90px 80px 72px", gap: 10, alignItems: "center", fontSize: 9, fontWeight: 700, color: T.txtTert, textTransform: "uppercase", letterSpacing: ".07em" }}>
          <div>#</div><div>Member</div><div style={{ textAlign: "center" }}>Workout</div><div style={{ textAlign: "center" }}>Diet</div><div style={{ textAlign: "center" }}>Perfect</div><div style={{ textAlign: "center" }}>Compliance</div><div style={{ textAlign: "center" }}>Tier</div>
        </div>
        {sorted.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: T.txtTert }}>No users found on the leaderboard yet.</div>
        ) : sorted.map((u, i) => {
          const sv = statVal(u);
          const isMe = u.isMe;
          const isHovered = hoverId === u.id;
          return (
            <div key={u.id}
              onMouseEnter={() => setHoverId(u.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                display: "grid", gridTemplateColumns: "44px 1fr 90px 90px 90px 80px 72px", gap: 10, padding: "13px 18px",
                borderBottom: `1px solid ${T.border}44`, alignItems: "center",
                background: isMe ? `${T.accent}10` : isHovered ? T.bgInput : "transparent",
                borderLeft: isMe ? `3px solid ${T.accent}` : "3px solid transparent",
                transition: "background .15s",
              }}>
              {/* Rank */}
              <div style={{ fontSize: i < 3 ? 18 : 12, textAlign: "center" }}>{i < 3 ? rankMedal[i] : <span style={{ fontWeight: 700, color: T.txtTert }}>#{i + 1}</span>}</div>
              {/* Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${tierColor[u.tier]}44,${tierColor[u.tier]}22)`, border: `2px solid ${tierColor[u.tier]}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{u.avatar}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.txtPrim, display: "flex", alignItems: "center", gap: 6 }}>
                    {u.name}{isMe && <span style={{ fontSize: 9, background: `${T.accent}22`, color: T.accentLt, border: `1px solid ${T.accent}44`, borderRadius: 4, padding: "1px 6px" }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 10, color: T.txtTert, marginTop: 1 }}>{u.city} · {u.goal}</div>
                </div>
              </div>
              {/* Workout streak */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: filter === "workout" ? "#5b7cf5" : T.txtPrim }}>{u.workoutStreak}d</div>
                <div style={{ fontSize: 8, color: T.txtTert }}>streak</div>
              </div>
              {/* Diet streak */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: filter === "diet" ? "#4db882" : T.txtPrim }}>{u.dietStreak}d</div>
                <div style={{ fontSize: 8, color: T.txtTert }}>streak</div>
              </div>
              {/* Perfect days */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: filter === "perfect" ? "#e8a83a" : T.txtPrim }}>{u.perfectDays}d</div>
                <div style={{ fontSize: 8, color: T.txtTert }}>both done</div>
              </div>
              {/* Compliance bar */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: u.compliance >= 90 ? "#4db882" : u.compliance >= 70 ? "#e8a83a" : "#e05555", textAlign: "center", marginBottom: 3 }}>{u.compliance}%</div>
                <div style={{ height: 4, background: T.bgInput, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, u.compliance))}%`, background: u.compliance >= 90 ? "#4db882" : u.compliance >= 70 ? "#e8a83a" : "#e05555", borderRadius: 2 }} />
                </div>
              </div>
              {/* Tier badge */}
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: tierColor[u.tier], background: tierBg[u.tier], border: `1px solid ${tierColor[u.tier]}44`, borderRadius: 5, padding: "3px 8px", display: "inline-block" }}>{u.badge} {u.tier}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tier legend */}
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        {[["👑 Diamond", "47+ day streak", "#00d4aa"], ["🥇 Gold", "25–46 days", "#e8a83a"], ["🥈 Silver", "15–24 days", "#b0b8c8"], ["🥉 Bronze", "1–14 days", "#cd7f32"]].map(([t, d, c]) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, background: T.bgCard, border: `1px solid ${c}33`, borderRadius: 7, padding: "8px 14px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c }}>{t}</div>
              <div style={{ fontSize: 9, color: T.txtTert }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PLACEHOLDER
════════════════════════════════════════════ */
