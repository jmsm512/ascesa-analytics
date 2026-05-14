
-- =============== PROFILES ===============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- =============== ATHLETES ===============
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sport text not null check (sport in ('hockey','fencing')),
  age int,
  height_cm numeric,
  weight_kg numeric,
  position text,
  weapon text,
  team text,
  club text,
  rating text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.athletes enable row level security;
create policy "athletes_all_own" on public.athletes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============== SESSIONS (parent) ===============
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null check (sport in ('hockey','fencing')),
  session_type text not null,
  session_date timestamptz not null default now(),
  location text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
create policy "sessions_all_own" on public.sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.sessions (athlete_id, session_date desc);

-- =============== HOCKEY ===============
create table public.hockey_sprint_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body_weight_kg numeric,
  created_at timestamptz not null default now()
);
alter table public.hockey_sprint_sessions enable row level security;
create policy "hss_all_own" on public.hockey_sprint_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.hockey_sprint_reps (
  id uuid primary key default gen_random_uuid(),
  hockey_session_id uuid not null references public.hockey_sprint_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null check (phase in ('baseline','resisted','closing','flying')),
  rep_number int not null,
  load_pct numeric,
  load_kg numeric,
  time_10m numeric,
  split_5m numeric,
  split_7_5m numeric,
  peak_kmh numeric,
  pct_of_max numeric,
  is_pb boolean default false,
  created_at timestamptz not null default now()
);
alter table public.hockey_sprint_reps enable row level security;
create policy "hsr_all_own" on public.hockey_sprint_reps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.hockey_sprint_reps (hockey_session_id, phase, rep_number);

create table public.hockey_step_data (
  id uuid primary key default gen_random_uuid(),
  rep_id uuid not null references public.hockey_sprint_reps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_number int not null,
  step_time numeric,
  step_length numeric,
  created_at timestamptz not null default now()
);
alter table public.hockey_step_data enable row level security;
create policy "hsd_all_own" on public.hockey_step_data for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============== FENCING ===============
create table public.fencing_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon text,
  opponent text,
  touches_scored int default 0,
  touches_received int default 0,
  result text check (result in ('win','loss','draw')),
  created_at timestamptz not null default now()
);
alter table public.fencing_sessions enable row level security;
create policy "fs_all_own" on public.fencing_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.fencing_actions (
  id uuid primary key default gen_random_uuid(),
  fencing_session_id uuid not null references public.fencing_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  successful boolean not null default false,
  timestamp_seconds numeric,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.fencing_actions enable row level security;
create policy "fa_all_own" on public.fencing_actions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.fencing_sensor_reps (
  id uuid primary key default gen_random_uuid(),
  fencing_session_id uuid not null references public.fencing_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rep_number int not null,
  attack_speed_ms numeric,
  footwork_cadence numeric,
  created_at timestamptz not null default now()
);
alter table public.fencing_sensor_reps enable row level security;
create policy "fsr_all_own" on public.fencing_sensor_reps for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============== VIDEOS ===============
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  label text,
  thumbnail_url text,
  video_url text,
  status text not null default 'pending' check (status in ('pending','processing','complete')),
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;
create policy "videos_all_own" on public.videos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.video_keyframes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  frame_index int,
  timestamp_seconds numeric,
  thumbnail_url text,
  created_at timestamptz not null default now()
);
alter table public.video_keyframes enable row level security;
create policy "vk_all_own" on public.video_keyframes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.video_pose_metrics (
  id uuid primary key default gen_random_uuid(),
  keyframe_id uuid not null references public.video_keyframes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_name text not null,
  value numeric,
  created_at timestamptz not null default now()
);
alter table public.video_pose_metrics enable row level security;
create policy "vpm_all_own" on public.video_pose_metrics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.video_ai_feedback (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback text,
  model text default 'claude-vision',
  created_at timestamptz not null default now()
);
alter table public.video_ai_feedback enable row level security;
create policy "vaf_all_own" on public.video_ai_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============== BENCHMARKS / GOALS ===============
create table public.athlete_benchmarks (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_name text not null,
  value numeric not null,
  unit text,
  recorded_at timestamptz not null default now()
);
alter table public.athlete_benchmarks enable row level security;
create policy "ab_all_own" on public.athlete_benchmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_name text not null,
  current_value numeric,
  target_value numeric not null,
  unit text,
  target_date date,
  created_at timestamptz not null default now()
);
alter table public.athlete_goals enable row level security;
create policy "ag_all_own" on public.athlete_goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============== SEED ON SIGNUP ===============
create or replace function public.seed_demo_data_for_user(_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yuta_id uuid;
  rie_id uuid;
  hockey_session_id uuid;
  fencing_session_outer uuid;
  hss_id uuid;
  fs_id uuid;
  rep_id uuid;
  rec record;
begin
  -- Athletes
  insert into public.athletes (user_id, name, sport, age, height_cm, weight_kg, position, team)
  values (_uid, 'Yuta', 'hockey', 13, 177.8, 68, 'Defense', 'Everett Junior Silvertips (PCAHA)')
  returning id into yuta_id;

  insert into public.athletes (user_id, name, sport, age, weapon, club, rating)
  values (_uid, 'Rie', 'fencing', 14, 'épée', 'Kaizen Academy', 'A-rated')
  returning id into rie_id;

  -- Hockey session
  insert into public.sessions (athlete_id, user_id, sport, session_type, session_date, location, notes)
  values (yuta_id, _uid, 'hockey', 'sprint', now(), 'Everett Rink',
    'Strong session. PB on flying sprint at 32.5 km/h.')
  returning id into hockey_session_id;

  insert into public.hockey_sprint_sessions (session_id, user_id, body_weight_kg)
  values (hockey_session_id, _uid, 68) returning id into hss_id;

  -- Baseline reps
  for rec in select * from (values
    (1, 2.41::numeric, 21.2::numeric),
    (2, 2.38, 21.8),
    (3, 2.35, 22.1),
    (4, 2.32, 22.5),
    (5, 2.34, 22.3)
  ) as t(n, t10, peak)
  loop
    insert into public.hockey_sprint_reps
      (hockey_session_id, user_id, phase, rep_number, load_pct, load_kg, time_10m, split_5m, split_7_5m, peak_kmh, pct_of_max, is_pb)
    values (hss_id, _uid, 'baseline', rec.n, 0, 0, rec.t10, rec.t10*0.55, rec.t10*0.78, rec.peak,
      round(rec.peak/22.5*100,1), rec.n=4);
  end loop;

  -- Resisted reps (avg 5 reps per load level — represented as 5 rows each)
  for rec in select * from (values
    -- 10% BW
    (1, 10::numeric, 6.8::numeric, 2.76::numeric, 18.5::numeric),
    (2, 10, 6.8, 2.95, 18.1),
    (3, 10, 6.8, 3.02, 18.0),
    (4, 10, 6.8, 3.06, 17.9),
    (5, 10, 6.8, 3.06, 18.2),
    -- 7%
    (6, 7, 4.8, 2.56, 19.3),
    (7, 7, 4.8, 2.59, 19.1),
    (8, 7, 4.8, 2.61, 19.0),
    (9, 7, 4.8, 2.63, 18.9),
    (10, 7, 4.8, 2.66, 19.0),
    -- 5%
    (11, 5, 3.4, 2.47, 20.2),
    (12, 5, 3.4, 2.49, 20.0),
    (13, 5, 3.4, 2.51, 19.9),
    (14, 5, 3.4, 2.53, 19.8),
    (15, 5, 3.4, 2.55, 19.9),
    -- 3%
    (16, 3, 2.0, 2.39, 20.3),
    (17, 3, 2.0, 2.51, 20.1),
    (18, 3, 2.0, 2.55, 20.0),
    (19, 3, 2.0, 2.59, 19.9),
    (20, 3, 2.0, 2.66, 20.2)
  ) as t(n, lp, lk, t10, peak)
  loop
    insert into public.hockey_sprint_reps
      (hockey_session_id, user_id, phase, rep_number, load_pct, load_kg, time_10m, split_5m, split_7_5m, peak_kmh, pct_of_max)
    values (hss_id, _uid, 'resisted', rec.n, rec.lp, rec.lk, rec.t10, rec.t10*0.55, rec.t10*0.78, rec.peak,
      round(rec.peak/22.5*100,1));
  end loop;

  -- Flying sprint
  for rec in select * from (values
    (1, 1.15::numeric, 32.2::numeric),
    (2, 1.18, 31.8),
    (3, 1.14, 32.4),
    (4, 1.13, 32.5),
    (5, 1.16, 31.9)
  ) as t(n, t10, peak)
  loop
    insert into public.hockey_sprint_reps
      (hockey_session_id, user_id, phase, rep_number, load_pct, load_kg, time_10m, split_5m, split_7_5m, peak_kmh, pct_of_max, is_pb)
    values (hss_id, _uid, 'flying', rec.n, 0, 0, rec.t10, rec.t10*0.55, rec.t10*0.78, rec.peak,
      round(rec.peak/32.5*100,1), rec.n=4);
  end loop;

  -- Fencing session
  insert into public.sessions (athlete_id, user_id, sport, session_type, session_date, location, notes)
  values (rie_id, _uid, 'fencing', 'bout', now(), 'Kaizen Academy', 'Won 5-3 vs sparring partner.')
  returning id into fencing_session_outer;

  insert into public.fencing_sessions (session_id, user_id, weapon, opponent, touches_scored, touches_received, result)
  values (fencing_session_outer, _uid, 'épée', 'Sparring partner', 5, 3, 'win')
  returning id into fs_id;

  -- 8 actions
  insert into public.fencing_actions (fencing_session_id, user_id, action_type, successful, timestamp_seconds) values
    (fs_id, _uid, 'attack', true, 12),
    (fs_id, _uid, 'attack', true, 45),
    (fs_id, _uid, 'attack', false, 78),
    (fs_id, _uid, 'parry', true, 95),
    (fs_id, _uid, 'parry', true, 142),
    (fs_id, _uid, 'lunge', true, 168),
    (fs_id, _uid, 'lunge', false, 201),
    (fs_id, _uid, 'riposte', true, 230);

  insert into public.fencing_sensor_reps (fencing_session_id, user_id, rep_number, attack_speed_ms, footwork_cadence) values
    (fs_id, _uid, 1, 3.2, 2.1),
    (fs_id, _uid, 2, 3.0, 2.0),
    (fs_id, _uid, 3, 3.4, 2.2),
    (fs_id, _uid, 4, 3.1, 2.1),
    (fs_id, _uid, 5, 3.3, 2.3);

  -- Benchmarks
  insert into public.athlete_benchmarks (athlete_id, user_id, metric_name, value, unit) values
    (yuta_id, _uid, 'best_10m_unloaded', 2.32, 's'),
    (yuta_id, _uid, 'top_speed', 22.5, 'km/h'),
    (yuta_id, _uid, 'flying_peak', 32.5, 'km/h'),
    (rie_id, _uid, 'attack_speed', 3.2, 'm/s'),
    (rie_id, _uid, 'bout_win_rate', 67, '%');

  -- Goals
  insert into public.athlete_goals (athlete_id, user_id, metric_name, current_value, target_value, unit, target_date) values
    (yuta_id, _uid, '10m sprint time', 2.32, 2.20, 's', now()::date + 60),
    (yuta_id, _uid, 'top speed', 22.5, 24.0, 'km/h', now()::date + 90),
    (rie_id, _uid, 'attack speed', 3.2, 3.6, 'm/s', now()::date + 60),
    (rie_id, _uid, 'bout win rate', 67, 80, '%', now()::date + 120);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  perform public.seed_demo_data_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
