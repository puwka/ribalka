-- Directory listing applications (shops / services / guides) + YooKassa orders

create table if not exists public.directory_listing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in ('shop', 'service', 'guide')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'RUB',
  status public.listing_order_status not null default 'pending',
  payment_provider text not null default 'yookassa',
  provider_payment_id text,
  confirmation_url text,
  description text,
  idempotence_key text,
  months integer not null default 3 check (months in (3, 6, 12)),
  addon_frame boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  directory_item_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists directory_listing_orders_idempotence_uidx
  on public.directory_listing_orders (idempotence_key)
  where idempotence_key is not null;

create unique index if not exists directory_listing_orders_provider_payment_uidx
  on public.directory_listing_orders (payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists directory_listing_orders_user_idx
  on public.directory_listing_orders (user_id, created_at desc);

create index if not exists directory_listing_orders_status_idx
  on public.directory_listing_orders (status, created_at desc);

drop trigger if exists directory_listing_orders_set_updated_at on public.directory_listing_orders;
create trigger directory_listing_orders_set_updated_at
before update on public.directory_listing_orders
for each row execute function public.set_updated_at();

insert into public.site_settings (key, value)
values (
  'directory_listing_service',
  jsonb_build_object(
    'title', 'Тариф справочника',
    'amountPerMonth', 590,
    'addonFrame', 100,
    'currency', 'RUB',
    'enabled', true
  )
)
on conflict (key) do nothing;
