-- Report weight/region for filters; comment moderation defaults

alter table public.fishing_reports
  add column if not exists weight_kg numeric(10, 2),
  add column if not exists region text;

create index if not exists fishing_reports_weight_kg_idx
  on public.fishing_reports (weight_kg)
  where weight_kg is not null;

create index if not exists fishing_reports_region_idx
  on public.fishing_reports (region)
  where region is not null;

-- New comments should start as pending (existing approved rows keep status)
alter table public.report_comments
  alter column status set default 'pending';

create index if not exists report_comments_status_idx
  on public.report_comments (status, created_at desc);
