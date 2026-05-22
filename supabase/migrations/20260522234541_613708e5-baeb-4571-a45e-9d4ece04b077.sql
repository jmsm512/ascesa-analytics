
ALTER TABLE public.hockey_step_data ALTER COLUMN rep_id DROP NOT NULL;
ALTER TABLE public.hockey_step_data
  ADD COLUMN IF NOT EXISTS video_id uuid,
  ADD COLUMN IF NOT EXISTS timestamp_seconds numeric,
  ADD COLUMN IF NOT EXISTS left_speed_ms numeric,
  ADD COLUMN IF NOT EXISTS right_speed_ms numeric;
CREATE INDEX IF NOT EXISTS hsd_video_idx ON public.hockey_step_data(video_id);

ALTER TABLE public.fencing_sensor_reps ALTER COLUMN fencing_session_id DROP NOT NULL;
ALTER TABLE public.fencing_sensor_reps
  ADD COLUMN IF NOT EXISTS video_id uuid,
  ADD COLUMN IF NOT EXISTS timestamp_seconds numeric,
  ADD COLUMN IF NOT EXISTS left_speed_ms numeric,
  ADD COLUMN IF NOT EXISTS right_speed_ms numeric;
CREATE INDEX IF NOT EXISTS fsr_video_idx ON public.fencing_sensor_reps(video_id);
