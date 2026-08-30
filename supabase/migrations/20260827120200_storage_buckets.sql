-- =============================================================================
-- Storage buckets for images / videos
-- Paths convention: {bucket}/{user_id|base_id}/{uuid}.ext
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'base-images',
    'base-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'base-videos',
    'base-videos',
    false,
    104857600,
    array['video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'report-images',
    'report-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'report-videos',
    'report-videos',
    false,
    104857600,
    array['video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'news-images',
    'news-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'advertising',
    'advertising',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'achievements',
    'achievements',
    true,
    2097152,
    array['image/png', 'image/webp', 'image/svg+xml']
  )
on conflict (id) do nothing;

-- Avatars: public read; owner write under own folder
create policy storage_avatars_select on storage.objects
  for select using (bucket_id = 'avatars');

create policy storage_avatars_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_avatars_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_avatars_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- Base images: public read; owner/admin write
create policy storage_base_images_select on storage.objects
  for select using (bucket_id = 'base-images');

create policy storage_base_images_write on storage.objects
  for all using (
    bucket_id = 'base-images'
    and (public.is_owner_or_admin())
  )
  with check (
    bucket_id = 'base-images'
    and (public.is_owner_or_admin())
  );

-- Base videos: authenticated read for owners; public can use youtube external_url mostly
create policy storage_base_videos_select on storage.objects
  for select using (
    bucket_id = 'base-videos'
    and (auth.role() = 'authenticated' or public.is_admin())
  );

create policy storage_base_videos_write on storage.objects
  for all using (
    bucket_id = 'base-videos' and public.is_owner_or_admin()
  )
  with check (
    bucket_id = 'base-videos' and public.is_owner_or_admin()
  );

-- Report images
create policy storage_report_images_select on storage.objects
  for select using (bucket_id = 'report-images');

create policy storage_report_images_insert on storage.objects
  for insert with check (
    bucket_id = 'report-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_report_images_delete on storage.objects
  for delete using (
    bucket_id = 'report-images'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- Report videos
create policy storage_report_videos_select on storage.objects
  for select using (
    bucket_id = 'report-videos'
    and auth.role() = 'authenticated'
  );

create policy storage_report_videos_insert on storage.objects
  for insert with check (
    bucket_id = 'report-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy storage_report_videos_delete on storage.objects
  for delete using (
    bucket_id = 'report-videos'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

-- News images: public read, admin write
create policy storage_news_images_select on storage.objects
  for select using (bucket_id = 'news-images');

create policy storage_news_images_write on storage.objects
  for all using (bucket_id = 'news-images' and public.is_admin())
  with check (bucket_id = 'news-images' and public.is_admin());

-- Advertising
create policy storage_advertising_select on storage.objects
  for select using (bucket_id = 'advertising');

create policy storage_advertising_write on storage.objects
  for all using (
    bucket_id = 'advertising'
    and (public.is_owner_or_admin())
  )
  with check (
    bucket_id = 'advertising'
    and (public.is_owner_or_admin())
  );

-- Achievements icons
create policy storage_achievements_select on storage.objects
  for select using (bucket_id = 'achievements');

create policy storage_achievements_write on storage.objects
  for all using (bucket_id = 'achievements' and public.is_admin())
  with check (bucket_id = 'achievements' and public.is_admin());
