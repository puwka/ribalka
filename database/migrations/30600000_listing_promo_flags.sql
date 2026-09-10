-- Promo options for bases + directory TOP addon

alter table public.bases
  add column if not exists is_top boolean not null default false,
  add column if not exists yellow_frame boolean not null default false;

create index if not exists bases_public_top_name_idx
  on public.bases (is_top desc, name)
  where status = 'approved';

alter table public.directory_listing_orders
  add column if not exists addon_top boolean not null default false;
