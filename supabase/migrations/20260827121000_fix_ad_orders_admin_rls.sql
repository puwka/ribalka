-- Fix: users has no `roles` column — use public.is_admin()
-- Safe to re-run if 20260827120900 partially applied.

drop policy if exists ad_orders_admin_all on public.ad_orders;
drop policy if exists ad_orders_owner_select on public.ad_orders;
drop policy if exists ad_orders_owner_insert on public.ad_orders;
drop policy if exists ad_orders_owner_update on public.ad_orders;

create policy ad_orders_owner_select on public.ad_orders
  for select using (auth.uid() = owner_id or public.is_admin());

create policy ad_orders_owner_insert on public.ad_orders
  for insert with check (auth.uid() = owner_id or public.is_admin());

create policy ad_orders_owner_update on public.ad_orders
  for update using (
    public.is_admin()
    or (auth.uid() = owner_id and status in ('draft', 'rejected'))
  )
  with check (
    public.is_admin()
    or (auth.uid() = owner_id and status in ('draft', 'rejected', 'pending'))
  );

create policy ad_orders_admin_all on public.ad_orders
  for all using (public.is_admin())
  with check (public.is_admin());
