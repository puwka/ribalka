-- CMS tables for site settings, pages, SEO, audit log
-- RLS omitted: access control is enforced in server/ REST API (no Supabase auth.uid()).

create table if not exists public.cms_kv (
  key text primary key,
  value jsonb not null default '{}',
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users (id) on delete set null,
  admin_name text,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists cms_audit_log_created_idx on public.cms_audit_log (created_at desc);

create trigger cms_kv_set_updated_at
before update on public.cms_kv
for each row execute function public.set_updated_at();
