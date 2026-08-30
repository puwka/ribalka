# База данных

## Postgres (Supabase)

Миграции: `supabase/migrations/`.

| Файл | Содержание |
|------|------------|
| `20260827120000_init_platform.sql` | ядро: users, roles, bases, reports, forum, bookings, plans, payments, ads, RLS helpers |
| `20260827120100_rls_policies.sql` | RLS |
| `20260827120200_storage_buckets.sql` | buckets + policies |
| `20260827120300_seed_plans_achievements.sql` | seed планов/достижений |
| `20260827120400_grants.sql` | GRANT |
| `20260827120500_base_review_owner_reply.sql` | ответ владельца на отзыв |
| `20260827120600_base_listing_moderation.sql` | enum value `approved` (отдельная транзакция) |
| `20260827120700_base_listing_moderation_apply.sql` | поля модерации баз + notify |
| `20260827120800_email_outbox.sql` | email_outbox + email_subscriptions |
| `20260827120900_monetization_extend.sql` | price_year/limits, ad_orders, payment columns |
| `20260827121000_fix_ad_orders_admin_rls.sql` | RLS ad_orders через `is_admin()` |
| `20260827121100_signup_requested_role.sql` | OWNER при регистрации из metadata |
| `20260827121200_monetization_grants.sql` | grants для ad_orders / email / plans |
| `20260827121300_fix_base_media_rls_approved.sql` | RLS media: `approved` вместо `published` |

Применение:

```bash
supabase db push
# или SQL Editor по файлам по порядку
```

## IndexedDB (local / hybrid UI)

| DB | Stores |
|----|--------|
| `rybalka_bases_db` | bases |
| `rybalka_bookings_db` | bookings, availability |
| `rybalka_social_db` | reports, forum_topics, forum_messages |
| `rybalka_monetization_db` | plans, subscriptions, payments, ad_orders |
| `rybalka_engagement_db` | favorites, achievements, stats |
| `rybalka_platform_db` | reviews, analytics |

## localStorage

- `rybalka_auth_store_v1` — local auth + notifications
- `rybalka_session_v1` — session
- `rybalka_email_outbox_v1` — очередь писем (архитектура)
- legacy `fishing_reports` → миграция в socialDb

## Важные enum/статусы

- Базы: `draft | pending | approved | rejected | archived`
- Брони: `pending | confirmed | cancelled | completed`
- Отчёты/форум контент: `pending | approved | rejected | hidden`
- Платежи: `pending | succeeded | failed | canceled | refunded`
- Реклама (ad_orders): `draft | pending | approved | active | rejected | paused | disabled | expired`
