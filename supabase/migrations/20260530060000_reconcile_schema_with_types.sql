-- Comprehensive schema reconciliation
-- Renames mismatched columns and adds missing ones to align the live DB
-- with the expected schema in src/integrations/supabase/types.ts

-- ─── athlete_benchmarks ──────────────────────────────────────────────────────
-- metric_value → value
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'athlete_benchmarks' AND column_name = 'metric_value'
  ) THEN
    ALTER TABLE public.athlete_benchmarks RENAME COLUMN metric_value TO value;
  END IF;
END $$;
ALTER TABLE public.athlete_benchmarks
  ADD COLUMN IF NOT EXISTS unit    text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── fencing_actions ─────────────────────────────────────────────────────────
-- success → successful
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fencing_actions' AND column_name = 'success'
  ) THEN
    ALTER TABLE public.fencing_actions RENAME COLUMN success TO successful;
  END IF;
END $$;
-- timestamp_s → timestamp_seconds
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fencing_actions' AND column_name = 'timestamp_s'
  ) THEN
    ALTER TABLE public.fencing_actions RENAME COLUMN timestamp_s TO timestamp_seconds;
  END IF;
END $$;
ALTER TABLE public.fencing_actions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── fencing_sensor_reps ─────────────────────────────────────────────────────
ALTER TABLE public.fencing_sensor_reps
  ADD COLUMN IF NOT EXISTS footwork_cadence  numeric,
  ADD COLUMN IF NOT EXISTS left_speed_ms     numeric,
  ADD COLUMN IF NOT EXISTS right_speed_ms    numeric,
  ADD COLUMN IF NOT EXISTS timestamp_seconds numeric,
  ADD COLUMN IF NOT EXISTS user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_id          uuid REFERENCES public.videos(id) ON DELETE SET NULL;

-- ─── fencing_sessions ────────────────────────────────────────────────────────
-- opponent_name → opponent
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fencing_sessions' AND column_name = 'opponent_name'
  ) THEN
    ALTER TABLE public.fencing_sessions RENAME COLUMN opponent_name TO opponent;
  END IF;
END $$;
-- score_athlete → touches_scored
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fencing_sessions' AND column_name = 'score_athlete'
  ) THEN
    ALTER TABLE public.fencing_sessions RENAME COLUMN score_athlete TO touches_scored;
  END IF;
END $$;
-- score_opponent → touches_received
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fencing_sessions' AND column_name = 'score_opponent'
  ) THEN
    ALTER TABLE public.fencing_sessions RENAME COLUMN score_opponent TO touches_received;
  END IF;
END $$;
ALTER TABLE public.fencing_sessions
  ADD COLUMN IF NOT EXISTS bout_type      text,
  ADD COLUMN IF NOT EXISTS event_name     text,
  ADD COLUMN IF NOT EXISTS result         text,
  ADD COLUMN IF NOT EXISTS speed_analysis jsonb,
  ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_url      text;

-- ─── hockey_sprint_reps ──────────────────────────────────────────────────────
-- sprint_session_id → hockey_session_id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'sprint_session_id'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN sprint_session_id TO hockey_session_id;
  END IF;
END $$;
-- load_bw_pct → load_pct
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'load_bw_pct'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN load_bw_pct TO load_pct;
  END IF;
END $$;
-- time_10m_s → time_10m
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'time_10m_s'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN time_10m_s TO time_10m;
  END IF;
END $$;
-- time_5m_s → split_5m
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'time_5m_s'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN time_5m_s TO split_5m;
  END IF;
END $$;
-- time_7_5m_s → split_7_5m
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'time_7_5m_s'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN time_7_5m_s TO split_7_5m;
  END IF;
END $$;
-- top_speed_kmh → peak_kmh
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hockey_sprint_reps' AND column_name = 'top_speed_kmh'
  ) THEN
    ALTER TABLE public.hockey_sprint_reps RENAME COLUMN top_speed_kmh TO peak_kmh;
  END IF;
END $$;
ALTER TABLE public.hockey_sprint_reps
  ADD COLUMN IF NOT EXISTS is_pb   boolean,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── hockey_sprint_sessions ──────────────────────────────────────────────────
ALTER TABLE public.hockey_sprint_sessions
  ADD COLUMN IF NOT EXISTS body_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── hockey_step_data ────────────────────────────────────────────────────────
ALTER TABLE public.hockey_step_data
  ADD COLUMN IF NOT EXISTS left_speed_ms     numeric,
  ADD COLUMN IF NOT EXISTS right_speed_ms    numeric,
  ADD COLUMN IF NOT EXISTS step_length       numeric,
  ADD COLUMN IF NOT EXISTS step_time         numeric,
  ADD COLUMN IF NOT EXISTS timestamp_seconds numeric,
  ADD COLUMN IF NOT EXISTS user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_id          uuid REFERENCES public.videos(id) ON DELETE SET NULL;

-- ─── sessions ────────────────────────────────────────────────────────────────
-- coach_notes → notes
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'coach_notes'
  ) THEN
    ALTER TABLE public.sessions RENAME COLUMN coach_notes TO notes;
  END IF;
END $$;
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS name      text,
  ADD COLUMN IF NOT EXISTS user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS video_url text;

-- ─── video_ai_feedback ───────────────────────────────────────────────────────
-- feedback_text → feedback
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'video_ai_feedback' AND column_name = 'feedback_text'
  ) THEN
    ALTER TABLE public.video_ai_feedback RENAME COLUMN feedback_text TO feedback;
  END IF;
END $$;
ALTER TABLE public.video_ai_feedback
  ADD COLUMN IF NOT EXISTS model   text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── video_keyframes ─────────────────────────────────────────────────────────
-- timestamp_s → timestamp_seconds
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'video_keyframes' AND column_name = 'timestamp_s'
  ) THEN
    ALTER TABLE public.video_keyframes RENAME COLUMN timestamp_s TO timestamp_seconds;
  END IF;
END $$;
-- storage_path → thumbnail_url
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'video_keyframes' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.video_keyframes RENAME COLUMN storage_path TO thumbnail_url;
  END IF;
END $$;
ALTER TABLE public.video_keyframes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── video_pose_metrics ──────────────────────────────────────────────────────
ALTER TABLE public.video_pose_metrics
  ADD COLUMN IF NOT EXISTS metric_name text,
  ADD COLUMN IF NOT EXISTS value       numeric,
  ADD COLUMN IF NOT EXISTS user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── videos ──────────────────────────────────────────────────────────────────
-- storage_path → video_url
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.videos RENAME COLUMN storage_path TO video_url;
  END IF;
END $$;
-- Add unified status column (DB had upload_status + analysis_status separately)
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS status        text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE;
-- Backfill status from upload_status if that column exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'upload_status'
  ) THEN
    UPDATE public.videos SET status = upload_status WHERE status IS NULL AND upload_status IS NOT NULL;
  END IF;
END $$;
