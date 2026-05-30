-- athlete_goals: add columns the app expects but the live table is missing
alter table public.athlete_goals
  add column if not exists user_id       uuid references auth.users(id) on delete cascade,
  add column if not exists current_value numeric,
  add column if not exists unit          text;

-- athletes: add fencing tracker and drill plan columns
alter table public.athletes
  add column if not exists fencing_tracker_url        text,
  add column if not exists fencing_tracker_data       jsonb,
  add column if not exists fencing_tracker_updated_at timestamptz,
  add column if not exists drill_plan                 jsonb;
