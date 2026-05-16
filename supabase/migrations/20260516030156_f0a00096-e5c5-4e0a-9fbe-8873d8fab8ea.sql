insert into storage.buckets (id, name, public) values ('videos', 'videos', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload videos" on storage.objects;
drop policy if exists "Authenticated users can read videos" on storage.objects;
drop policy if exists "Authenticated users can update videos" on storage.objects;

create policy "Authenticated users can upload videos"
on storage.objects for insert to authenticated
with check (bucket_id = 'videos');

create policy "Authenticated users can read videos"
on storage.objects for select to authenticated
using (bucket_id = 'videos');

create policy "Authenticated users can update videos"
on storage.objects for update to authenticated
using (bucket_id = 'videos')
with check (bucket_id = 'videos');