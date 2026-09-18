-- Sidebar ads: daily billing + view/click stats

alter table public.advertising
  add column if not exists days int not null default 1,
  add column if not exists views_count int not null default 0,
  add column if not exists clicks_count int not null default 0;

-- Seed daily price only when setting is missing
insert into public.site_settings (key, value, updated_at)
select
  'sidebar_ad_price',
  '{"title":"Боковой баннер","amount":300,"unit":"day","currency":"RUB","enabled":true}'::jsonb,
  now()
where not exists (
  select 1 from public.site_settings where key = 'sidebar_ad_price'
);
