-- Sidebar ads: page surface (news | forum), 4 slots per surface

alter table public.advertising
  add column if not exists surface text not null default 'news';

alter table public.advertising
  drop constraint if exists advertising_surface_check;

alter table public.advertising
  add constraint advertising_surface_check
  check (surface in ('news', 'forum'));

update public.advertising
set surface = 'news'
where surface is null or surface = '';

create index if not exists advertising_surface_placement_active_idx
  on public.advertising (surface, placement, status)
  where status = 'active' and ad_type = 'sidebar';
