-- Paid media slots from constructor addons (+100 ₽ each)

alter table public.bases
  add column if not exists paid_extra_photos int not null default 0,
  add column if not exists paid_extra_videos int not null default 0;

comment on column public.bases.paid_extra_photos is
  'Extra photo slots purchased via listing constructor (beyond included 1)';
comment on column public.bases.paid_extra_videos is
  'Extra video slots purchased via listing constructor (beyond included 1)';
