-- Listing period end date for paid bases + directory analytics events

alter table public.bases
  add column if not exists paid_until timestamptz;

create index if not exists bases_paid_until_idx
  on public.bases (paid_until)
  where paid_until is not null;

create table if not exists public.directory_listing_events (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  owner_id uuid references public.users (id) on delete set null,
  event_type text not null check (event_type in ('view', 'phone', 'website')),
  session_key text,
  created_at timestamptz not null default now()
);

create index if not exists directory_listing_events_item_idx
  on public.directory_listing_events (item_id, created_at desc);

create index if not exists directory_listing_events_owner_idx
  on public.directory_listing_events (owner_id, created_at desc);

create index if not exists directory_listing_events_type_idx
  on public.directory_listing_events (event_type, created_at desc);
