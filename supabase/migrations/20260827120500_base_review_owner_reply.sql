-- Owner replies to base reviews (OWNER cabinet)

alter table public.base_reviews
  add column if not exists owner_reply text,
  add column if not exists owner_replied_at timestamptz,
  add column if not exists owner_id uuid references public.users (id) on delete set null;

create index if not exists base_reviews_owner_id_idx on public.base_reviews (owner_id);
