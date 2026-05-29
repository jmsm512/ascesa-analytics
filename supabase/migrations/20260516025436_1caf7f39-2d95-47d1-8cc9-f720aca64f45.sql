ALTER TABLE public.fencing_sessions ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.fencing_sessions ADD COLUMN IF NOT EXISTS speed_analysis JSONB;