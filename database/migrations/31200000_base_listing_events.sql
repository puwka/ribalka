-- Analytics events for fishing bases (views, clicks, favorites)

create table if not exists public.base_listing_events (
  id uuid primary key default gen_random_uuid(),
  base_id text not null,
  owner_id uuid references public.users (id) on delete set null,
  event_type text not null check (
    event_type in ('view', 'click', 'phone', 'map', 'website', 'favorite_add', 'favorite_remove')
  ),
  source text,
  session_key text,
  created_at timestamptz not null default now()
);

create index if not exists base_listing_events_base_idx
  on public.base_listing_events (base_id, created_at desc);

create index if not exists base_listing_events_owner_idx
  on public.base_listing_events (owner_id, created_at desc);

create index if not exists base_listing_events_type_idx
  on public.base_listing_events (event_type, created_at desc);
