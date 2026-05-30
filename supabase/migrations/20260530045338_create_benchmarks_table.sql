create table if not exists public.benchmarks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  name         text not null,
  notes        text,
  speed_analysis jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_benchmarks_athlete on public.benchmarks(athlete_id);

alter table public.benchmarks enable row level security;

create policy "bm_all_own" on public.benchmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.benchmarks to authenticated;
