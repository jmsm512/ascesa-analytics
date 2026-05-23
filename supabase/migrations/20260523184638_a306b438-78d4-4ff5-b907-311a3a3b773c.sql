ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS video_url text;