ALTER TABLE public.fencing_sessions
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS bout_type text CHECK (bout_type IN ('pool','de'));