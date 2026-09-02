-- =============================================================================
-- Рыбалка в Прикамье — initial platform schema
-- Maps existing frontend static/localStorage data onto Supabase Postgres
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.app_role as enum ('user', 'owner', 'admin');

create type public.user_status as enum ('active', 'blocked', 'deleted');

create type public.base_type as enum ('paid', 'free');

create type public.content_status as enum (
  'draft',
  'pending',
  'published',
  'rejected',
  'archived'
);

create type public.moderation_status as enum (
  'pending',
  'approved',
  'rejected',
  'hidden'
);

create type public.media_provider as enum ('storage', 'youtube', 'external');

create type public.comment_target as enum (
  'report',
  'news',
  'base',
  'forum_topic'
);

create type public.notification_type as enum (
  'system',
  'comment',
  'reply',
  'booking',
  'payment',
  'achievement',
  'moderation',
  'subscription',
  'referral'
);

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired'
);

create type public.payment_status as enum (
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'canceled'
);

create type public.booking_status as enum (
  'pending',
  'confirmed',
  'canceled',
  'completed',
  'no_show'
);

create type public.ad_type as enum (
  'banner',
  'directory',
  'sponsored_base',
  'sidebar'
);

create type public.ad_status as enum (
  'draft',
  'active',
  'paused',
  'expired'
);

create type public.calendar_entry_type as enum (
  'ban',
  'event',
  'season',
  'note'
);

create type public.calendar_severity as enum (
  'low',
  'medium',
  'high',
  'critical'
);

-- -----------------------------------------------------------------------------
-- updated_at helper
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Roles (RBAC catalog)
-- -----------------------------------------------------------------------------

create table public.roles (
  id smallserial primary key,
  code public.app_role not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name, description) values
  ('user',  'Пользователь', 'Базовый доступ: просмотр, отчёты, избранное, форум'),
  ('owner', 'Владелец базы', 'Управление своими базами, бронированиями, аналитикой'),
  ('admin', 'Администратор', 'Полный доступ к платформе и модерации');

-- -----------------------------------------------------------------------------
-- Users (app identity — standalone Postgres, no Supabase Auth)
-- Replaces: hardcoded AdminPage session + anonymous fishing_user_id
-- -----------------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null default '',
  status public.user_status not null default 'active',
  primary_role public.app_role not null default 'user',
  referral_code text unique,
  referred_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create index users_status_idx on public.users (status);
create index users_primary_role_idx on public.users (primary_role);
create index users_referred_by_idx on public.users (referred_by);

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Extra roles (e.g. user+owner); primary_role stays for fast checks
create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id smallint not null references public.roles (id) on delete restrict,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.users (id) on delete set null,
  primary key (user_id, role_id)
);

create index user_roles_role_id_idx on public.user_roles (role_id);

-- -----------------------------------------------------------------------------
-- Profiles (public card)
-- -----------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  display_name text not null,
  slug text unique,
  avatar_path text,
  bio text,
  phone text,
  city text default 'Пермь',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_display_name_idx on public.profiles (display_name);
create index profiles_is_public_idx on public.profiles (is_public) where is_public = true;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Role helpers (optional; authorization enforced in API layer)
create or replace function public.has_role(p_user_id uuid, p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = p_user_id
      and u.status = 'active'
      and r.code = p_role
  )
  or exists (
    select 1 from public.users u
    where u.id = p_user_id
      and u.status = 'active'
      and u.primary_role = p_role
  );
$$;

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(p_user_id, 'admin');
$$;

create or replace function public.is_owner_or_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(p_user_id, 'owner') or public.has_role(p_user_id, 'admin');
$$;

-- -----------------------------------------------------------------------------
-- Bases  ← src/data/bases.js (paidBases + freePlaces)
-- -----------------------------------------------------------------------------

create table public.bases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users (id) on delete set null,
  type public.base_type not null,
  status public.content_status not null default 'draft',
  name text not null,
  short_description text,
  description text,
  price_label text,
  price_from numeric(12, 2),
  currency char(3) not null default 'RUB',
  fish_species text,
  address text,
  region text default 'Пермский край',
  lat double precision,
  lng double precision,
  how_to_get text,
  transport text,
  weather_notes text,
  phone text,
  work_hours text,
  website_url text,
  slug text unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bases_coords_pair check (
    (lat is null and lng is null) or (lat is not null and lng is not null)
  )
);

create index bases_type_status_idx on public.bases (type, status);
create index bases_owner_id_idx on public.bases (owner_id);
create index bases_published_idx on public.bases (published_at desc)
  where status = 'published';
create index bases_geo_idx on public.bases (lat, lng)
  where lat is not null and lng is not null;
create index bases_name_trgm_ready_idx on public.bases (lower(name));

create trigger bases_set_updated_at
before update on public.bases
for each row execute function public.set_updated_at();

-- base_images ← bases[].images
create table public.base_images (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases (id) on delete cascade,
  storage_path text,
  external_url text,
  provider public.media_provider not null default 'storage',
  alt_text text,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint base_images_source check (
    storage_path is not null or external_url is not null
  )
);

create index base_images_base_id_idx on public.base_images (base_id, sort_order);

-- base_videos ← bases[].videos / freePlaces[].video
create table public.base_videos (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases (id) on delete cascade,
  storage_path text,
  external_url text,
  provider public.media_provider not null default 'youtube',
  title text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint base_videos_source check (
    storage_path is not null or external_url is not null
  )
);

create index base_videos_base_id_idx on public.base_videos (base_id, sort_order);

-- base_services ← bases[].services[]
create table public.base_services (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (base_id, name)
);

create index base_services_base_id_idx on public.base_services (base_id);

-- base_reviews ← BaseModal localStorage comments-base-*
create table public.base_reviews (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  author_name text not null,
  body text not null,
  rating smallint check (rating between 1 and 5),
  status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index base_reviews_base_id_idx on public.base_reviews (base_id, created_at desc);
create index base_reviews_status_idx on public.base_reviews (status);

create trigger base_reviews_set_updated_at
before update on public.base_reviews
for each row execute function public.set_updated_at();

-- Analytics: views
create table public.base_views (
  id bigserial primary key,
  base_id uuid not null references public.bases (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  session_id text,
  source text,
  viewed_at timestamptz not null default now()
);

create index base_views_base_viewed_idx on public.base_views (base_id, viewed_at desc);
create index base_views_user_idx on public.base_views (user_id, viewed_at desc);

-- Favorites
create table public.base_favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  base_id uuid not null references public.bases (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, base_id)
);

create index base_favorites_base_id_idx on public.base_favorites (base_id);

-- -----------------------------------------------------------------------------
-- Fishing reports ← useReports / localStorage fishing_reports
-- -----------------------------------------------------------------------------

create table public.fishing_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  author_name text not null,
  base_id uuid references public.bases (id) on delete set null,
  place_name text not null,
  trip_date date not null,
  fish_caught text,
  bait text,
  weight_label text,
  description text not null,
  rating_score int not null default 0,
  status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fishing_reports_status_date_idx
  on public.fishing_reports (status, trip_date desc);
create index fishing_reports_user_id_idx on public.fishing_reports (user_id);
create index fishing_reports_base_id_idx on public.fishing_reports (base_id);
create index fishing_reports_rating_idx on public.fishing_reports (rating_score desc);

create trigger fishing_reports_set_updated_at
before update on public.fishing_reports
for each row execute function public.set_updated_at();

create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  storage_path text,
  external_url text,
  provider public.media_provider not null default 'storage',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint report_images_source check (
    storage_path is not null or external_url is not null
  )
);

create index report_images_report_id_idx on public.report_images (report_id, sort_order);

create table public.report_videos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  storage_path text,
  external_url text,
  provider public.media_provider not null default 'youtube',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint report_videos_source check (
    storage_path is not null or external_url is not null
  )
);

create index report_videos_report_id_idx on public.report_videos (report_id, sort_order);

-- Votes (replaces votedBy[] in localStorage)
create table public.report_votes (
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Comments (polymorphic) ← report comments + future news/forum
-- -----------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type public.comment_target not null,
  target_id uuid not null,
  user_id uuid references public.users (id) on delete set null,
  author_name text not null,
  body text not null,
  parent_id uuid references public.comments (id) on delete cascade,
  status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_target_idx on public.comments (target_type, target_id, created_at);
create index comments_parent_id_idx on public.comments (parent_id);
create index comments_user_id_idx on public.comments (user_id);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Forum
-- -----------------------------------------------------------------------------

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  slug text unique,
  body text not null,
  status public.content_status not null default 'published',
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  replies_count int not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index forum_topics_status_idx on public.forum_topics (status, last_message_at desc);
create index forum_topics_author_id_idx on public.forum_topics (author_id);

create trigger forum_topics_set_updated_at
before update on public.forum_topics
for each row execute function public.set_updated_at();

create table public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  parent_id uuid references public.forum_messages (id) on delete set null,
  status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index forum_messages_topic_id_idx
  on public.forum_messages (topic_id, created_at);
create index forum_messages_author_id_idx on public.forum_messages (author_id);

create trigger forum_messages_set_updated_at
before update on public.forum_messages
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Achievements
-- -----------------------------------------------------------------------------

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon_path text,
  points int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references public.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

create index user_achievements_achievement_id_idx
  on public.user_achievements (achievement_id);

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text,
  link_path text,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, is_read, created_at desc);

-- -----------------------------------------------------------------------------
-- Monetization: plans / subscriptions / payments
-- -----------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_month numeric(12, 2) not null default 0,
  currency char(3) not null default 'RUB',
  features jsonb not null default '[]'::jsonb,
  target_role public.app_role not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  booking_id uuid,
  provider text not null default 'manual',
  provider_payment_id text,
  amount numeric(12, 2) not null,
  currency char(3) not null default 'RUB',
  status public.payment_status not null default 'pending',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_id_idx on public.payments (user_id, created_at desc);
create index payments_status_idx on public.payments (status);
create unique index payments_provider_payment_id_uidx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Advertising ← DirectoryPage + footer sponsors
-- -----------------------------------------------------------------------------

create table public.advertising (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users (id) on delete set null,
  ad_type public.ad_type not null,
  status public.ad_status not null default 'draft',
  title text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  image_path text,
  image_url text,
  target_url text,
  phone text,
  address text,
  base_id uuid references public.bases (id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index advertising_type_status_idx on public.advertising (ad_type, status);
create index advertising_active_window_idx
  on public.advertising (starts_at, ends_at)
  where status = 'active';

create trigger advertising_set_updated_at
before update on public.advertising
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Referrals
-- -----------------------------------------------------------------------------

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users (id) on delete cascade,
  referred_id uuid not null references public.users (id) on delete cascade,
  code_used text not null,
  reward_points int not null default 0,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index referrals_referrer_id_idx on public.referrals (referrer_id);

-- -----------------------------------------------------------------------------
-- News ← src/data/news.js
-- -----------------------------------------------------------------------------

create table public.news (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users (id) on delete set null,
  title text not null,
  slug text unique,
  excerpt text,
  content text not null,
  cover_path text,
  cover_url text,
  category text,
  status public.content_status not null default 'draft',
  views_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_status_published_idx on public.news (status, published_at desc);
create index news_category_idx on public.news (category);

create trigger news_set_updated_at
before update on public.news
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Calendar ← src/data/calendarData.js
-- -----------------------------------------------------------------------------

create table public.calendar_data (
  id uuid primary key default gen_random_uuid(),
  entry_type public.calendar_entry_type not null,
  title text not null,
  description text,
  fish text,
  region text,
  severity public.calendar_severity,
  start_date date not null,
  end_date date,
  year int generated always as (extract(year from start_date)::int) stored,
  meta jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_data_dates check (
    end_date is null or end_date >= start_date
  )
);

create index calendar_data_range_idx
  on public.calendar_data (start_date, end_date)
  where is_active = true;
create index calendar_data_type_year_idx
  on public.calendar_data (entry_type, year);

create trigger calendar_data_set_updated_at
before update on public.calendar_data
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bookings (paid bases)
-- -----------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.bases (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete cascade,
  owner_id uuid references public.users (id) on delete set null,
  status public.booking_status not null default 'pending',
  guests_count int not null default 1 check (guests_count > 0),
  check_in date not null,
  check_out date not null,
  total_amount numeric(12, 2),
  currency char(3) not null default 'RUB',
  contact_phone text,
  contact_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates check (check_out > check_in)
);

create index bookings_base_dates_idx on public.bookings (base_id, check_in, check_out);
create index bookings_user_id_idx on public.bookings (user_id, created_at desc);
create index bookings_owner_status_idx on public.bookings (owner_id, status);

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- Late FK: payments.booking_id → bookings
alter table public.payments
  add constraint payments_booking_id_fkey
  foreign key (booking_id) references public.bookings (id) on delete set null;

create index payments_booking_id_idx on public.payments (booking_id);

-- Keep report rating in sync with votes
create or replace function public.sync_report_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fishing_reports r
  set rating_score = (
    select count(*)::int from public.report_votes v where v.report_id = coalesce(new.report_id, old.report_id)
  )
  where r.id = coalesce(new.report_id, old.report_id);
  return coalesce(new, old);
end;
$$;

create trigger report_votes_sync_rating
after insert or delete on public.report_votes
for each row execute function public.sync_report_rating();

-- Forum replies counter
create or replace function public.sync_forum_replies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.forum_topics
    set replies_count = replies_count + 1,
        last_message_at = new.created_at
    where id = new.topic_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.forum_topics
    set replies_count = greatest(replies_count - 1, 0)
    where id = old.topic_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger forum_messages_sync_replies
after insert or delete on public.forum_messages
for each row execute function public.sync_forum_replies();
