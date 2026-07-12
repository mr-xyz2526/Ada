-- ═══════════════════════════════════════════════════════════════════════
-- AdaptFit v7 — COMPLETE Supabase Database Setup
-- Run ALL of this in Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  age            INTEGER DEFAULT 25,
  gender         TEXT DEFAULT 'Male',
  height         NUMERIC DEFAULT 170,
  weight         NUMERIC DEFAULT 70,
  goal           TEXT DEFAULT 'Fat Loss',
  activity_level TEXT DEFAULT 'Moderately Active',
  workout_type   TEXT DEFAULT 'Gym',
  workout_hours  NUMERIC DEFAULT 1,
  workout_days   INTEGER DEFAULT 4,
  fitness_level  TEXT DEFAULT 'Beginner',
  city           TEXT DEFAULT '',
  avatar_url     TEXT,
  last_update    TIMESTAMPTZ DEFAULT now()
);

-- Add any missing columns (safe for existing installations)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fitness_level  TEXT DEFAULT 'Beginner';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workout_type   TEXT DEFAULT 'Gym';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workout_hours  NUMERIC DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workout_days   INTEGER DEFAULT 4;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'Moderately Active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal           TEXT DEFAULT 'Fat Loss';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age            INTEGER DEFAULT 25;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender         TEXT DEFAULT 'Male';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height         NUMERIC DEFAULT 170;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight         NUMERIC DEFAULT 70;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name      TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city           TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url     TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_update    TIMESTAMPTZ DEFAULT now();

-- ─── 2. PROGRESS LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  weight     NUMERIC,
  bmi        NUMERIC,
  calories   INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. WORKOUT PLANS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_plans (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data  JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. DIET PLANS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_plans (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data  JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. COMMUNITY POSTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  likes       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. INTEGRATIONS DATA (NEW) ──────────────────────────────────────
-- Stores per-user app/device connection status
CREATE TABLE IF NOT EXISTS public.integrations_data (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id       TEXT NOT NULL,
  connected    BOOLEAN DEFAULT false,
  synced_stats TEXT DEFAULT '—',
  connected_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, app_id)
);

-- ─── 7. WORKOUT LOGS (NEW) ───────────────────────────────────────────
-- Stores user's daily workout completion (exercise checkboxes)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date   DATE DEFAULT CURRENT_DATE,
  day_label  TEXT,
  focus      TEXT,
  exercises  JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- ─── 8. LEADERBOARD STATS (NEW) ──────────────────────────────────────
-- Stores per-user streak and compliance data (publicly readable)
CREATE TABLE IF NOT EXISTS public.leaderboard_stats (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  city            TEXT DEFAULT '',
  goal            TEXT DEFAULT 'Fat Loss',
  workout_streak  INTEGER DEFAULT 0,
  diet_streak     INTEGER DEFAULT 0,
  total_days      INTEGER DEFAULT 0,
  workout_done    INTEGER DEFAULT 0,
  diet_done       INTEGER DEFAULT 0,
  tier            TEXT DEFAULT 'Bronze',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. SYNC EVENTS (NEW) ────────────────────────────────────────────
-- Immutable log of real integration sync actions
CREATE TABLE IF NOT EXISTS public.sync_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id     TEXT,
  app_name   TEXT,
  app_icon   TEXT DEFAULT '📱',
  event_type TEXT,
  detail     TEXT,
  ok         BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_events       ENABLE ROW LEVEL SECURITY;

-- ── Drop old policies safely ──────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"        ON public.profiles;
DROP POLICY IF EXISTS "community_select"       ON public.community_posts;
DROP POLICY IF EXISTS "community_insert"       ON public.community_posts;
DROP POLICY IF EXISTS "community_update_likes" ON public.community_posts;
DROP POLICY IF EXISTS "progress_select"        ON public.progress_logs;
DROP POLICY IF EXISTS "progress_insert"        ON public.progress_logs;
DROP POLICY IF EXISTS "workout_all"            ON public.workout_plans;
DROP POLICY IF EXISTS "diet_all"               ON public.diet_plans;
DROP POLICY IF EXISTS "integrations_all"       ON public.integrations_data;
DROP POLICY IF EXISTS "workout_logs_all"       ON public.workout_logs;
DROP POLICY IF EXISTS "leaderboard_select"     ON public.leaderboard_stats;
DROP POLICY IF EXISTS "leaderboard_upsert"     ON public.leaderboard_stats;
DROP POLICY IF EXISTS "sync_events_all"        ON public.sync_events;

-- ── PROFILES: own row only ────────────────────────────────────────────
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ── COMMUNITY: public read, authenticated write ───────────────────────
CREATE POLICY "community_select"       ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "community_insert"       ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_update_likes" ON public.community_posts FOR UPDATE USING (true);

-- ── PROGRESS LOGS: own rows only ─────────────────────────────────────
CREATE POLICY "progress_select" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_insert" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── WORKOUT & DIET PLANS: own rows only ──────────────────────────────
CREATE POLICY "workout_all" ON public.workout_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "diet_all"    ON public.diet_plans    FOR ALL USING (auth.uid() = user_id);

-- ── INTEGRATIONS DATA: own rows only ─────────────────────────────────
CREATE POLICY "integrations_all" ON public.integrations_data FOR ALL USING (auth.uid() = user_id);

-- ── WORKOUT LOGS: own rows only ──────────────────────────────────────
CREATE POLICY "workout_logs_all" ON public.workout_logs FOR ALL USING (auth.uid() = user_id);

-- ── LEADERBOARD: public read, own row write ───────────────────────────
CREATE POLICY "leaderboard_select" ON public.leaderboard_stats FOR SELECT USING (true);
CREATE POLICY "leaderboard_upsert" ON public.leaderboard_stats FOR ALL   USING (auth.uid() = user_id);

-- ── SYNC EVENTS: own rows only ───────────────────────────────────────
CREATE POLICY "sync_events_all" ON public.sync_events FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- COMMUNITY SEED DATA (run only once — safe if run again due to content check)
-- ═══════════════════════════════════════════════════════════════════════
INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Priya Mehta',
  'Just hit a new PR on squats today! 100kg for 3 reps! 🎉 So excited to finally cross that milestone after 4 months of consistent training.',
  NOW() - INTERVAL '2 hours',
  24
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Priya Mehta' AND likes = 24
);

INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Rahul Sharma',
  'Rest day feels weird when you''re used to pushing hard 6 days a week... but recovery is just as important as the iron. Foam rolling and walks for me today! 💪',
  NOW() - INTERVAL '1 day',
  15
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Rahul Sharma' AND likes = 15
);

INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Sneha Kapoor',
  'Does anyone else feel like Bulgarian split squats are a form of medieval torture? 🥵 Leg day is DONE though! My gym-bro said "embrace the pain" — I said "embrace the protein shake".',
  NOW() - INTERVAL '3 hours',
  42
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Sneha Kapoor' AND likes = 42
);

INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Arjun Singh',
  'The AR Pushup Analyzer is actually incredible — it correctly detected my elbow flare on rep 8 before I even felt it. This is next-level form coaching! 🤳',
  NOW() - INTERVAL '5 hours',
  18
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Arjun Singh' AND likes = 18
);

INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Vikram Nair',
  'Meal prep Sunday done! 15 containers ready for the week — hitting 160g protein daily without having to think about it. Paneer + brown rice + broccoli combo is unbeatable 🍱',
  NOW() - INTERVAL '2 days',
  31
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Vikram Nair' AND likes = 31
);

INSERT INTO public.community_posts (user_id, author_name, content, created_at, likes)
SELECT
  NULL,
  'Ananya Iyer',
  'Week 6 of fat loss and I''m down 3.5kg! The AdaptFit diet plan has been a game-changer. Eating real food, not starving myself, and still in a deficit. This is how it should be done. 🌟',
  NOW() - INTERVAL '4 hours',
  56
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_posts WHERE author_name = 'Ananya Iyer' AND likes = 56
);

-- ═══════════════════════════════════════════════════════════════════════
-- DONE ✅
-- Tables created:
--   profiles, progress_logs, workout_plans, diet_plans, community_posts (existing)
--   integrations_data, workout_logs, leaderboard_stats, sync_events (NEW)
--
-- Next: Run this SQL in Supabase → SQL Editor → New Query → Run
-- Your .env file should have:
--   VITE_SUPABASE_URL=https://txlpgjmxugqdyeisrqkq.supabase.co
--   VITE_SUPABASE_ANON_KEY=sb_publishable_BMfjeaFf37irlyDsGPyuHg_6ozUVjJC
-- ═══════════════════════════════════════════════════════════════════════
