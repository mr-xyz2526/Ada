import { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

export default function Community({ user, T }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPosts();
    let subscription;
    try {
      subscription = supabase
        .channel("community_posts_channel")
        .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => fetchPosts())
        .subscribe();
    } catch (err) { console.warn("Realtime failed:", err); }
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, []);

  const fetchPosts = async () => {
    try {
      // community_posts has: id, user_id, author_name, content, created_at
      // We do NOT join profiles — use author_name column directly
      const { data, error: fetchErr } = await supabase
        .from("community_posts")
        .select("id, user_id, author_name, content, created_at, likes")
        .order("created_at", { ascending: false })
        .limit(50);
      if (fetchErr) throw fetchErr;
      setPosts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error("Fetch posts error:", err);
      setError("Could not load posts — " + (err.message || "check connection"));
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    const text = newPost.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
      
      if (authErr || !authUser) {
        if (user?.email === "rahul@adaptfit.ai") {
          // Demo mode mock post
          setPosts([{ id: Date.now(), user_id: 'demo', author_name: user.name, content: text, likes: 0, created_at: new Date().toISOString() }, ...posts]);
          setNewPost("");
          setPosting(false);
          return;
        }
        throw new Error("Not logged in — please sign in again.");
      }

      const { error: insertErr } = await supabase.from("community_posts").insert([{
        user_id: authUser.id,
        author_name: user?.name || authUser.email?.split("@")[0] || "User",
        content: text,
        likes: 0,
      }]);
      if (insertErr) throw insertErr;
      setNewPost("");
      await fetchPosts();
    } catch (err) {
      console.error("Post error:", err);
      setError("Post failed: " + (err.message || "try again"));
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId, currentLikes) => {
    // Optimistic update first
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p));
    
    if (user?.email === "rahul@adaptfit.ai") return; // Demo mode fakes the like

    try {
      await supabase.from("community_posts").update({ likes: (currentLikes || 0) + 1 }).eq("id", postId);
    } catch (err) {
      // Revert on failure
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max((p.likes || 1) - 1, 0) } : p));
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", animation: "fadeUp .4s ease" }}>
      {/* Hero */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 20, backgroundImage: "url('https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80')", backgroundSize: "cover", backgroundPosition: "center 40%", height: 120 }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,0.85),rgba(0,0,0,0.4))" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#5b7cf5,#00d4aa)" }} />
        <div style={{ position: "relative", zIndex: 1, padding: "22px 28px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#00d4aa", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 5 }}>COMMUNITY</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-.5px", marginBottom: 4 }}>Fitness Feed</h1>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Share your journey · Connect with others</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "rgba(224,85,85,0.12)", border: "1px solid rgba(224,85,85,0.35)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#e05555", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#e05555", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* Post composer */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#5b7cf5,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0, fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <textarea
            placeholder="Share your fitness journey, a win, a tip…"
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handlePost(); }}
            rows={3}
            style={{ flex: 1, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.txtPrim, resize: "none", outline: "none", fontSize: 13, fontFamily: "DM Sans", lineHeight: 1.5 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: T.txtTert }}>Ctrl+Enter to post</span>
          <button
            onClick={handlePost}
            disabled={!newPost.trim() || posting}
            style={{ background: !newPost.trim() || posting ? T.bgInput : "#5b7cf5", color: !newPost.trim() || posting ? T.txtTert : "#fff", border: "none", padding: "8px 20px", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: !newPost.trim() || posting ? "not-allowed" : "pointer", fontFamily: "DM Sans", transition: "all .15s" }}
          >
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${T.border}`, borderTopColor: "#5b7cf5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 12, color: T.txtTert }}>Loading posts…</div>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: T.bgCard, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.txtPrim, marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 12, color: T.txtTert }}>Be the first to share your fitness journey!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, transition: "border-color .15s" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#5b7cf5,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", flexShrink: 0, fontWeight: 700 }}>
                  {(post.author_name || "U").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.txtPrim }}>{post.author_name || "Anonymous"}</div>
                  <div style={{ fontSize: 10, color: T.txtTert }}>{formatTime(post.created_at)}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: T.txtSec, lineHeight: 1.6, marginBottom: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {post.content}
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <button onClick={() => handleLike(post.id, post.likes)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T.txtTert, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "DM Sans" }}>
                  <span style={{ fontSize: 14 }}>❤️</span> {post.likes || 0}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
