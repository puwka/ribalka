-- Separate catalog: paid fishing spots vs recreation bases
alter type public.base_type add value if not exists 'paid_fishing';

comment on type public.base_type is
  'paid = recreation base; paid_fishing = paid fishing spot; free = free water';
