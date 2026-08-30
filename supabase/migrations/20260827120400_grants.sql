-- Grants for role helpers used by RLS (callable from policies)

grant usage on schema public to anon, authenticated;

grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_owner_or_admin() to anon, authenticated;
grant execute on function public.owns_base(uuid) to anon, authenticated;
grant execute on function public.owns_report(uuid) to anon, authenticated;

-- Table privileges (RLS still applies)
grant select on public.roles to anon, authenticated;
grant select, update on public.users to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select on public.bases to anon, authenticated;
grant insert, update, delete on public.bases to authenticated;

grant select on public.base_images to anon, authenticated;
grant insert, update, delete on public.base_images to authenticated;
grant select on public.base_videos to anon, authenticated;
grant insert, update, delete on public.base_videos to authenticated;
grant select on public.base_services to anon, authenticated;
grant insert, update, delete on public.base_services to authenticated;

grant select on public.base_reviews to anon, authenticated;
grant insert, update, delete on public.base_reviews to authenticated;

grant insert on public.base_views to anon, authenticated;
grant select on public.base_views to authenticated;

grant select, insert, delete on public.base_favorites to authenticated;

grant select on public.fishing_reports to anon, authenticated;
grant insert, update, delete on public.fishing_reports to authenticated;
grant select on public.report_images to anon, authenticated;
grant insert, update, delete on public.report_images to authenticated;
grant select on public.report_videos to anon, authenticated;
grant insert, update, delete on public.report_videos to authenticated;
grant select on public.report_votes to anon, authenticated;
grant insert, delete on public.report_votes to authenticated;

grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;

grant select on public.forum_topics to anon, authenticated;
grant insert, update, delete on public.forum_topics to authenticated;
grant select on public.forum_messages to anon, authenticated;
grant insert, update, delete on public.forum_messages to authenticated;

grant select on public.achievements to anon, authenticated;
grant select on public.user_achievements to authenticated;

grant select, update on public.notifications to authenticated;
grant insert on public.notifications to authenticated;

grant select on public.plans to anon, authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant select, insert on public.payments to authenticated;

grant select on public.advertising to anon, authenticated;
grant insert, update, delete on public.advertising to authenticated;

grant select, insert on public.referrals to authenticated;

grant select on public.news to anon, authenticated;
grant select on public.calendar_data to anon, authenticated;

grant select, insert, update on public.bookings to authenticated;

-- Sequences
grant usage, select on all sequences in schema public to authenticated;
