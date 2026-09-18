-- Password reset + payment renewal reminder tracking

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens (user_id, created_at desc);

create table if not exists public.payment_reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('base', 'directory')),
  entity_id text not null,
  reminder_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id, reminder_key)
);

create index if not exists payment_reminder_log_sent_idx
  on public.payment_reminder_log (sent_at desc);

alter table public.email_subscriptions
  add column if not exists payment_reminders boolean not null default true;
