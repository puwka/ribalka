-- Grants for monetization / email tables added later
grant select, insert, update on public.ad_orders to authenticated;
grant select on public.ad_orders to anon;

grant select, insert, update on public.email_outbox to authenticated;
grant select, insert, update on public.email_subscriptions to authenticated;

grant update on public.payments to authenticated; -- status updates via webhook/service role preferred; RLS limits
grant select, insert, update on public.plans to authenticated; -- admin write gated by RLS
