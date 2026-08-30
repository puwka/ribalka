-- Monetization extensions: yearly prices, limits, discounts, ad order types, payment providers meta

alter table public.plans
  add column if not exists price_year numeric(12, 2),
  add column if not exists period_days_month int not null default 30,
  add column if not exists period_days_year int not null default 365,
  add column if not exists discount_year_percent numeric(5, 2) not null default 0,
  add column if not exists limits jsonb not null default '{}'::jsonb,
  add column if not exists sort_order int not null default 100;

comment on column public.plans.price_year is 'Yearly price; discount_year_percent is informational';
comment on column public.plans.limits is 'e.g. {bases, ads_active, featured, search_boost, mailing}';

-- Expand advertising statuses/types via text checks if enums are rigid —
-- prefer new ad_orders table for owner orders + moderation workflow
create table if not exists public.ad_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  ad_type text not null
    check (ad_type in ('banner', 'search_promo', 'featured', 'mailing', 'promo_campaign')),
  title text not null,
  description text,
  target_url text,
  base_id uuid references public.bases (id) on delete set null,
  budget numeric(12, 2) not null default 0,
  currency char(3) not null default 'RUB',
  status text not null default 'draft'
    check (status in (
      'draft', 'pending', 'approved', 'active', 'rejected', 'paused', 'disabled', 'expired'
    )),
  starts_at timestamptz,
  ends_at timestamptz,
  moderation_note text,
  moderated_by uuid references public.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_orders_owner_idx on public.ad_orders (owner_id, created_at desc);
create index if not exists ad_orders_status_idx on public.ad_orders (status, created_at desc);

alter table public.payments
  add column if not exists plan_id uuid references public.plans (id) on delete set null,
  add column if not exists billing_period text
    check (billing_period is null or billing_period in ('month', 'year')),
  add column if not exists confirmation_url text,
  add column if not exists error_message text,
  add column if not exists paid_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists failed_at timestamptz;

-- provider remains text; allow yookassa / robokassa / manual in app layer

alter table public.ad_orders enable row level security;

drop policy if exists ad_orders_owner_select on public.ad_orders;
create policy ad_orders_owner_select on public.ad_orders
  for select using (auth.uid() = owner_id or public.is_admin());

drop policy if exists ad_orders_owner_insert on public.ad_orders;
create policy ad_orders_owner_insert on public.ad_orders
  for insert with check (auth.uid() = owner_id or public.is_admin());

drop policy if exists ad_orders_owner_update on public.ad_orders;
create policy ad_orders_owner_update on public.ad_orders
  for update using (
    public.is_admin()
    or (auth.uid() = owner_id and status in ('draft', 'rejected'))
  )
  with check (
    public.is_admin()
    or (auth.uid() = owner_id and status in ('draft', 'rejected', 'pending'))
  );

drop policy if exists ad_orders_admin_all on public.ad_orders;
create policy ad_orders_admin_all on public.ad_orders
  for all using (public.is_admin())
  with check (public.is_admin());
