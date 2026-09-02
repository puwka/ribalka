-- Email outbox for digest / marketing campaigns (processed by server worker)

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  campaign text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_status_idx
  on public.email_outbox (status, created_at);

create table if not exists public.email_subscriptions (
  user_id uuid primary key references public.users (id) on delete cascade,
  weekly_digest boolean not null default true,
  new_bases boolean not null default true,
  bite_forecast boolean not null default true,
  news boolean not null default true,
  updated_at timestamptz not null default now()
);
