# База данных

## PostgreSQL (standalone)

Миграции: `database/migrations/`.

| Файл | Содержание |
|------|------------|
| `001_init_platform.sql` | ядро: users (+ password_hash), roles, bases, reports, forum, bookings, plans, payments, ads |
| `002_seed_plans_achievements.sql` | seed планов/достижений |
| `003_base_review_owner_reply.sql` | ответ владельца на отзыв |
| `004_base_listing_moderation.sql` | enum `approved` |
| `005_base_listing_moderation_apply.sql` | поля модерации баз + notify |
| `006_email_outbox.sql` | email_outbox + email_subscriptions |
| `007_monetization_extend.sql` | price_year/limits, ad_orders, payment columns |

Применение:

```bash
DATABASE_URL=postgresql://... npm run db:migrate
```

Админ:

```bash
npm run db:seed-admin -- admin@example.com password
```

Отличия от Supabase: без `auth.users`, без RLS/Storage — права в REST API (`server/`).

Папка `supabase/migrations/` устарела (архив).

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
