-- ═══════════════════════════════════════════════════════════════
-- AdaptFit v5 — Complete Supabase SQL Setup
-- Paste ALL of this into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. PROFILES TABLE ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fitness_level  TEXT DEFAULT 'Beginner',
  ADD COLUMN IF NOT EXISTS workout_type   TEXT DEFAULT 'Gym',
  ADD COLUMN IF NOT EXISTS workout_hours  NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS workout_days   INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'Moderately Active',
  ADD COLUMN IF NOT EXISTS goal           TEXT DEFAULT 'Fat Loss',
  ADD COLUMN IF NOT EXISTS age            INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS gender         TEXT DEFAULT 'Male',
  ADD COLUMN IF NOT EXISTS height         NUMERIC DEFAULT 170,
  ADD COLUMN IF NOT EXISTS weight         NUMERIC DEFAULT 70,
  ADD COLUMN IF NOT EXISTS full_name      TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS last_update    TIMESTAMPTZ DEFAULT now();

-- ─── 2. COMMUNITY POSTS TABLE ────────────────────────────────
-- Fix: Drop old FK if it references wrong table, re-create correctly
-- The community_posts table exists with: id, user_id, author_name, content, created_at

-- Add likes column if missing
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Fix the foreign key — drop old one and re-add correctly
-- (This handles the "violates foreign key constraint" error)
DO $$
BEGIN
  -- Drop existing FK on user_id if it exists
  ALTER TABLE public.community_posts
    DROP CONSTRAINT IF EXISTS community_posts_user_id_fkey;
  
  -- Re-add FK referencing auth.users correctly
  ALTER TABLE public.community_posts
    ADD CONSTRAINT community_posts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK constraint update: %', SQLERRM;
END $$;

-- ─── 3. PROGRESS LOGS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  weight     NUMERIC,
  bmi        NUMERIC,
  calories   INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. WORKOUT PLANS TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workout_plans (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data  JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. DIET PLANS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diet_plans (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data  JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — MUST RUN THESE TOO
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans       ENABLE ROW LEVEL SECURITY;

-- Drop old policies first to avoid duplicate errors
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

-- PROFILES: own row only
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- COMMUNITY: everyone reads, only owner inserts, anyone can like
CREATE POLICY "community_select"       ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "community_insert"       ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_update_likes" ON public.community_posts FOR UPDATE USING (true);

-- PROGRESS LOGS
CREATE POLICY "progress_select" ON public.progress_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_insert" ON public.progress_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- WORKOUT & DIET PLANS
CREATE POLICY "workout_all" ON public.workout_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "diet_all"    ON public.diet_plans    FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- DONE ✅
-- After running this, update your .env:
--   VITE_SUPABASE_URL=https://jvkfbwlmnvyyzjykdtly.supabase.co
--   VITE_SUPABASE_ANON_KEY=<your anon key from Project Settings → API>
-- ═══════════════════════════════════════════════════════════════
