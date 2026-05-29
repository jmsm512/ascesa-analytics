
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'videos_athlete_id_fkey'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_athlete_id_fkey
      FOREIGN KEY (athlete_id) REFERENCES public.athletes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'videos_session_id_fkey'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_athlete_id ON public.videos(athlete_id);
CREATE INDEX IF NOT EXISTS idx_videos_session_id ON public.videos(session_id);
