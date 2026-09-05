-- Site reviews for catalog waters (string target ids) + directory listing prices helpers

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  target_id text not null,
  target_name text,
  user_id uuid references public.users (id) on delete set null,
  author_name text not null,
  body text not null,
  rating smallint check (rating between 1 and 5),
  status public.moderation_status not null default 'pending',
  owner_reply text,
  owner_replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_reviews_target_idx
  on public.site_reviews (target_id, created_at desc);
create index if not exists site_reviews_status_idx
  on public.site_reviews (status);

create trigger site_reviews_set_updated_at
before update on public.site_reviews
for each row execute function public.set_updated_at();

alter table public.fishing_reports
  add column if not exists moderation_note text,
  add column if not exists moderated_at timestamptz;
