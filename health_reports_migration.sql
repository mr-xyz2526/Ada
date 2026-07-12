-- SQL Migration for Health Reports
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.health_reports (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type  TEXT NOT NULL, -- e.g., 'Knee', 'Shoulder', 'Back', 'Hip', 'Wrist', 'General'
  description TEXT,
  severity    TEXT DEFAULT 'Low', -- 'Low', 'Medium', 'High'
  status      TEXT DEFAULT 'Active', -- 'Active', 'Resolved'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Only owner can see/manage their reports
DROP POLICY IF EXISTS "health_reports_all" ON public.health_reports;
CREATE POLICY "health_reports_all" ON public.health_reports FOR ALL USING (auth.uid() = user_id);

-- Add column for quick profile awareness (optional but helpful)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_active_injury BOOLEAN DEFAULT false;
