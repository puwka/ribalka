-- =============================================================================
-- RLS policies — USER / OWNER / ADMIN
-- =============================================================================

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.bases enable row level security;
alter table public.base_images enable row level security;
alter table public.base_videos enable row level security;
alter table public.base_services enable row level security;
alter table public.base_reviews enable row level security;
alter table public.base_views enable row level security;
alter table public.base_favorites enable row level security;
alter table public.fishing_reports enable row level security;
alter table public.report_images enable row level security;
alter table public.report_videos enable row level security;
alter table public.report_votes enable row level security;
alter table public.comments enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_messages enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.advertising enable row level security;
alter table public.referrals enable row level security;
alter table public.news enable row level security;
alter table public.calendar_data enable row level security;
alter table public.bookings enable row level security;

-- Roles catalog: public read
create policy roles_select_all on public.roles
  for select using (true);

-- Users
create policy users_select_own_or_admin on public.users
  for select using (id = auth.uid() or public.is_admin());

create policy users_update_own on public.users
  for update using (id = auth.uid() or public.is_admin());

-- User roles
create policy user_roles_select_own_or_admin on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_roles_admin_write on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- Profiles
create policy profiles_select_public_or_own on public.profiles
  for select using (is_public = true or user_id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid() or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid() or public.is_admin());

-- Bases: published for everyone; owners manage own; admin all
create policy bases_select_published_or_owner on public.bases
  for select using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy bases_insert_owner_admin on public.bases
  for insert with check (
    public.is_admin()
    or (public.has_role('owner') and owner_id = auth.uid())
  );

create policy bases_update_owner_admin on public.bases
  for update using (owner_id = auth.uid() or public.is_admin());

create policy bases_delete_owner_admin on public.bases
  for delete using (owner_id = auth.uid() or public.is_admin());

-- Helper: can manage base media if owns base
create or replace function public.owns_base(p_base_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bases b
    where b.id = p_base_id
      and (b.owner_id = auth.uid() or public.is_admin())
  );
$$;

create policy base_images_select on public.base_images
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'published' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy base_images_write on public.base_images
  for all using (public.owns_base(base_id))
  with check (public.owns_base(base_id));

create policy base_videos_select on public.base_videos
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'published' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy base_videos_write on public.base_videos
  for all using (public.owns_base(base_id))
  with check (public.owns_base(base_id));

create policy base_services_select on public.base_services
  for select using (
    exists (
      select 1 from public.bases b
      where b.id = base_id
        and (b.status = 'published' or b.owner_id = auth.uid() or public.is_admin())
    )
  );

create policy base_services_write on public.base_services
  for all using (public.owns_base(base_id))
  with check (public.owns_base(base_id));

-- Reviews
create policy base_reviews_select on public.base_reviews
  for select using (
    status = 'approved'
    or user_id = auth.uid()
    or public.is_admin()
    or public.owns_base(base_id)
  );

create policy base_reviews_insert on public.base_reviews
  for insert with check (
    auth.uid() is not null
    and (user_id = auth.uid() or user_id is null)
  );

create policy base_reviews_update_own_admin on public.base_reviews
  for update using (user_id = auth.uid() or public.is_admin());

create policy base_reviews_delete_own_admin on public.base_reviews
  for delete using (user_id = auth.uid() or public.is_admin());

-- Views: anyone can insert (analytics), owners/admins read own bases
create policy base_views_insert on public.base_views
  for insert with check (true);

create policy base_views_select_owner_admin on public.base_views
  for select using (
    public.is_admin()
    or public.owns_base(base_id)
    or user_id = auth.uid()
  );

-- Favorites
create policy base_favorites_own on public.base_favorites
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Reports
create policy fishing_reports_select on public.fishing_reports
  for select using (
    status = 'approved'
    or user_id = auth.uid()
    or public.is_admin()
  );

create policy fishing_reports_insert on public.fishing_reports
  for insert with check (
    auth.uid() is not null and (user_id = auth.uid() or user_id is null)
  );

create policy fishing_reports_update on public.fishing_reports
  for update using (user_id = auth.uid() or public.is_admin());

create policy fishing_reports_delete on public.fishing_reports
  for delete using (user_id = auth.uid() or public.is_admin());

create or replace function public.owns_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.fishing_reports r
    where r.id = p_report_id
      and (r.user_id = auth.uid() or public.is_admin())
  );
$$;

create policy report_images_select on public.report_images
  for select using (
    exists (
      select 1 from public.fishing_reports r
      where r.id = report_id
        and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
    )
  );

create policy report_images_write on public.report_images
  for all using (public.owns_report(report_id))
  with check (public.owns_report(report_id));

create policy report_videos_select on public.report_videos
  for select using (
    exists (
      select 1 from public.fishing_reports r
      where r.id = report_id
        and (r.status = 'approved' or r.user_id = auth.uid() or public.is_admin())
    )
  );

create policy report_videos_write on public.report_videos
  for all using (public.owns_report(report_id))
  with check (public.owns_report(report_id));

create policy report_votes_select on public.report_votes
  for select using (true);

create policy report_votes_insert on public.report_votes
  for insert with check (user_id = auth.uid());

create policy report_votes_delete on public.report_votes
  for delete using (user_id = auth.uid() or public.is_admin());

-- Comments
create policy comments_select on public.comments
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

create policy comments_insert on public.comments
  for insert with check (
    auth.uid() is not null and (user_id = auth.uid() or user_id is null)
  );

create policy comments_update on public.comments
  for update using (user_id = auth.uid() or public.is_admin());

create policy comments_delete on public.comments
  for delete using (user_id = auth.uid() or public.is_admin());

-- Forum
create policy forum_topics_select on public.forum_topics
  for select using (
    status = 'published' or author_id = auth.uid() or public.is_admin()
  );

create policy forum_topics_insert on public.forum_topics
  for insert with check (author_id = auth.uid());

create policy forum_topics_update on public.forum_topics
  for update using (author_id = auth.uid() or public.is_admin());

create policy forum_topics_delete on public.forum_topics
  for delete using (author_id = auth.uid() or public.is_admin());

create policy forum_messages_select on public.forum_messages
  for select using (
    status = 'approved' or author_id = auth.uid() or public.is_admin()
  );

create policy forum_messages_insert on public.forum_messages
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.forum_topics t
      where t.id = topic_id and t.is_locked = false and t.status = 'published'
    )
  );

create policy forum_messages_update on public.forum_messages
  for update using (author_id = auth.uid() or public.is_admin());

create policy forum_messages_delete on public.forum_messages
  for delete using (author_id = auth.uid() or public.is_admin());

-- Achievements
create policy achievements_select on public.achievements
  for select using (is_active = true or public.is_admin());

create policy achievements_admin_write on public.achievements
  for all using (public.is_admin()) with check (public.is_admin());

create policy user_achievements_select on public.user_achievements
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_achievements_admin_write on public.user_achievements
  for all using (public.is_admin()) with check (public.is_admin());

-- Notifications
create policy notifications_own on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid() or public.is_admin());

create policy notifications_insert_admin on public.notifications
  for insert with check (public.is_admin() or user_id = auth.uid());

-- Plans / subscriptions / payments
create policy plans_select on public.plans
  for select using (is_active = true or public.is_admin());

create policy plans_admin_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy subscriptions_select on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

create policy subscriptions_insert on public.subscriptions
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy subscriptions_update on public.subscriptions
  for update using (user_id = auth.uid() or public.is_admin());

create policy payments_select on public.payments
  for select using (user_id = auth.uid() or public.is_admin());

create policy payments_insert on public.payments
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy payments_admin_update on public.payments
  for update using (public.is_admin());

-- Advertising (directory + banners)
create policy advertising_select on public.advertising
  for select using (
    status = 'active'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy advertising_write on public.advertising
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Referrals
create policy referrals_select on public.referrals
  for select using (
    referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin()
  );

create policy referrals_insert on public.referrals
  for insert with check (
    referred_id = auth.uid() or public.is_admin()
  );

-- News
create policy news_select on public.news
  for select using (
    status = 'published' or author_id = auth.uid() or public.is_admin()
  );

create policy news_admin_write on public.news
  for all using (public.is_admin())
  with check (public.is_admin());

-- Calendar
create policy calendar_select on public.calendar_data
  for select using (is_active = true or public.is_admin());

create policy calendar_admin_write on public.calendar_data
  for all using (public.is_admin())
  with check (public.is_admin());

-- Bookings
create policy bookings_select on public.bookings
  for select using (
    user_id = auth.uid()
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy bookings_insert on public.bookings
  for insert with check (user_id = auth.uid());

create policy bookings_update on public.bookings
  for update using (
    user_id = auth.uid()
    or owner_id = auth.uid()
    or public.is_admin()
  );
