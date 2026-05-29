ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS fencing_tracker_url text,
  ADD COLUMN IF NOT EXISTS fencing_tracker_data jsonb,
  ADD COLUMN IF NOT EXISTS fencing_tracker_updated_at timestamptz;