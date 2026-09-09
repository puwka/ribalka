-- Likes / stars / comments for fishing reports (+ wipe old districts)

create table if not exists public.report_likes (
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  voter_key text not null,
  user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (report_id, voter_key)
);

create index if not exists report_likes_user_idx on public.report_likes (user_id);

create table if not exists public.report_stars (
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  voter_key text not null,
  user_id uuid references public.users (id) on delete set null,
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (report_id, voter_key)
);

create table if not exists public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.fishing_reports (id) on delete cascade,
  author_name text not null,
  user_id uuid references public.users (id) on delete set null,
  body text not null,
  parent_id uuid references public.report_comments (id) on delete set null,
  status text not null default 'approved',
  created_at timestamptz not null default now()
);

create index if not exists report_comments_report_idx on public.report_comments (report_id, created_at);

-- Remove previously seeded / leftover districts list (admin can re-add)
delete from public.cms_kv where key = 'districts';
