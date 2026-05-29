-- Add columns present in the app schema but missing from the live athletes table
alter table public.athletes
  add column if not exists age        int,
  add column if not exists weapon     text,
  add column if not exists club       text,
  add column if not exists rating     text,
  add column if not exists avatar_url text;
