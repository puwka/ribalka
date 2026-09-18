-- Sidebar banners: placement, budget, moderation workflow (status as text)
-- Drop indexes that depend on enum-typed status before altering the column.

drop index if exists public.advertising_active_window_idx;
drop index if exists public.advertising_type_status_idx;
drop index if exists public.advertising_placement_active_idx;

alter table public.advertising
  alter column status drop default;

alter table public.advertising
  alter column status type text using (status::text);

alter table public.advertising
  alter column status set default 'draft';

alter table public.advertising
  drop constraint if exists advertising_status_check;

alter table public.advertising
  add constraint advertising_status_check
  check (status in ('draft', 'pending', 'active', 'paused', 'expired', 'rejected'));

alter table public.advertising
  alter column ad_type type text using (ad_type::text);

alter table public.advertising
  drop constraint if exists advertising_ad_type_check;

alter table public.advertising
  add constraint advertising_ad_type_check
  check (ad_type in ('banner', 'directory', 'sponsored_base', 'sidebar'));

alter table public.advertising
  add column if not exists placement text not null default 'right',
  add column if not exists budget numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'RUB',
  add column if not exists moderation_note text,
  add column if not exists moderated_by uuid references public.users (id) on delete set null,
  add column if not exists moderated_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists months int not null default 1;

alter table public.advertising
  drop constraint if exists advertising_placement_check;

alter table public.advertising
  add constraint advertising_placement_check
  check (placement in ('left', 'right'));

create index if not exists advertising_type_status_idx
  on public.advertising (ad_type, status);

create index if not exists advertising_active_window_idx
  on public.advertising (starts_at, ends_at)
  where status = 'active';

create index if not exists advertising_placement_active_idx
  on public.advertising (placement, status)
  where status = 'active';
