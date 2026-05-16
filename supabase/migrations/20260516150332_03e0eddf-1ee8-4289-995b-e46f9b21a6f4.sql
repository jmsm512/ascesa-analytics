
CREATE TABLE public.benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  speed_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_benchmarks_athlete ON public.benchmarks(athlete_id);

ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bm_all_own"
ON public.benchmarks
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
