-- =============== STORAGE BUCKETS ===============
insert into storage.buckets (id, name, public)
values
  ('videos',    'videos',    false),
  ('keyframes', 'keyframes', false);

-- =============== VIDEOS BUCKET POLICIES ===============
-- Files must be stored under {user_id}/filename so (storage.foldername(name))[1] = auth.uid()

create policy "videos_select_own" on storage.objects
  for select using (
    bucket_id = 'videos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "videos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'videos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "videos_update_own" on storage.objects
  for update using (
    bucket_id = 'videos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "videos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'videos'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============== KEYFRAMES BUCKET POLICIES ===============

create policy "keyframes_select_own" on storage.objects
  for select using (
    bucket_id = 'keyframes'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "keyframes_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'keyframes'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "keyframes_update_own" on storage.objects
  for update using (
    bucket_id = 'keyframes'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "keyframes_delete_own" on storage.objects
  for delete using (
    bucket_id = 'keyframes'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
