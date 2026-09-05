-- Listing orders (paid base placement) + site settings for price
-- No RLS: access control in Express API

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value)
values (
  'base_listing',
  jsonb_build_object(
    'title', 'Размещение рыболовной базы',
    'amount', 5000,
    'currency', 'RUB',
    'enabled', true
  )
)
on conflict (key) do nothing;

do $$ begin
  create type public.listing_order_status as enum (
    'pending',
    'waiting_for_payment',
    'paid',
    'cancelled',
    'failed',
    'refunded',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.listing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  base_id uuid not null references public.bases (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  currency char(3) not null default 'RUB',
  status public.listing_order_status not null default 'pending',
  payment_provider text not null default 'yookassa',
  provider_payment_id text,
  confirmation_url text,
  description text,
  idempotence_key text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

create unique index if not exists listing_orders_idempotence_uidx
  on public.listing_orders (idempotence_key)
  where idempotence_key is not null;

create unique index if not exists listing_orders_provider_payment_uidx
  on public.listing_orders (payment_provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists listing_orders_user_idx
  on public.listing_orders (user_id, created_at desc);

create index if not exists listing_orders_base_idx
  on public.listing_orders (base_id, created_at desc);

create index if not exists listing_orders_status_idx
  on public.listing_orders (status, created_at desc);

create trigger listing_orders_set_updated_at
before update on public.listing_orders
for each row execute function public.set_updated_at();

-- Link payments table to listing orders (optional FK via meta; add column)
alter table public.payments
  add column if not exists listing_order_id uuid references public.listing_orders (id) on delete set null,
  add column if not exists confirmation_url text,
  add column if not exists paid_at timestamptz,
  add column if not exists error_message text;

create index if not exists payments_listing_order_idx
  on public.payments (listing_order_id)
  where listing_order_id is not null;
