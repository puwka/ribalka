-- Allow admin to delete bases that have listing/booking history

alter table public.listing_orders
  drop constraint if exists listing_orders_base_id_fkey;

alter table public.listing_orders
  add constraint listing_orders_base_id_fkey
  foreign key (base_id) references public.bases (id) on delete cascade;

alter table public.bookings
  drop constraint if exists bookings_base_id_fkey;

alter table public.bookings
  add constraint bookings_base_id_fkey
  foreign key (base_id) references public.bases (id) on delete cascade;
