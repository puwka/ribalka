-- Allow months=0 for TOP-only directory orders (top_daily)
alter table public.directory_listing_orders
  drop constraint if exists directory_listing_orders_months_check;

alter table public.directory_listing_orders
  add constraint directory_listing_orders_months_check
  check (months in (0, 3, 6, 12));
