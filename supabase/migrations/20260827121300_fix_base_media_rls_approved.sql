-- Fix base media RLS: bases use status 'approved', not 'published'.

drop policy if exists base_images_select on public.base_images;
create policy base_images_select on public.base_images
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'approved' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists base_videos_select on public.base_videos;
create policy base_videos_select on public.base_videos
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'approved' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists base_services_select on public.base_services;
create policy base_services_select on public.base_services
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'approved' or b.owner_id = auth.uid() or public.is_admin())
    )
  );
