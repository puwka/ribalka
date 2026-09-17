-- Homepage TOP slots: timed TOP + daily boost

alter table public.bases
  add column if not exists top_until timestamptz,
  add column if not exists top_kind text;

create index if not exists bases_active_top_idx
  on public.bases (top_until desc nulls last)
  where is_top = true and status = 'approved' and type = 'paid';
