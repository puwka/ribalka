-- Explicit flag for paid catalog filter «с водоёмом / без водоёма»
alter table public.bases
  add column if not exists has_water boolean;

comment on column public.bases.has_water is
  'true = fishing water on site; false = recreation base without water; null = legacy (heuristic)';
