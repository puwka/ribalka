-- Wallet balance, contests (reports + monthly activity), prizes, withdrawals

alter table public.users
  add column if not exists balance_rub numeric(12, 2) not null default 0;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount_rub numeric(12, 2) not null,
  kind text not null,
  -- prize | withdraw_hold | withdraw_paid | withdraw_refund | adjustment
  status text not null default 'posted',
  contest_id uuid,
  withdrawal_id uuid,
  title text not null default '',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_idx
  on public.wallet_transactions (user_id, created_at desc);

create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('reports', 'monthly_activity')),
  title text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'settled', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settled_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contests_type_status_idx
  on public.contests (type, status, ends_at desc);

create trigger contests_set_updated_at
before update on public.contests
for each row execute function public.set_updated_at();

create table if not exists public.contest_prizes (
  contest_id uuid not null references public.contests (id) on delete cascade,
  place smallint not null check (place between 1 and 10),
  amount_rub numeric(12, 2) not null check (amount_rub >= 0),
  primary key (contest_id, place)
);

create table if not exists public.contest_awards (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests (id) on delete cascade,
  place smallint not null,
  user_id uuid not null references public.users (id) on delete cascade,
  amount_rub numeric(12, 2) not null,
  score numeric(12, 2) not null default 0,
  report_id uuid references public.fishing_reports (id) on delete set null,
  credited boolean not null default false,
  created_at timestamptz not null default now(),
  unique (contest_id, place),
  unique (contest_id, user_id)
);

create index if not exists contest_awards_user_idx
  on public.contest_awards (user_id, created_at desc);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  amount_rub numeric(12, 2) not null check (amount_rub > 0),
  card_masked text not null default '',
  card_details text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'rejected')),
  admin_note text not null default '',
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_status_idx
  on public.withdrawals (status, created_at desc);

create index if not exists withdrawals_user_idx
  on public.withdrawals (user_id, created_at desc);

create trigger withdrawals_set_updated_at
before update on public.withdrawals
for each row execute function public.set_updated_at();
