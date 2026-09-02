# Архитектура

## Обзор

Клиентское SPA с двумя режимами данных:

1. **Local** (`VITE_USE_API=false`) — IndexedDB / localStorage, демо-аккаунты.
2. **API + Postgres** (`VITE_USE_API=true`) — JWT auth, REST API, PostgreSQL на сервере.

UI всегда React. Бизнес-логика — в `src/services/*`.

```
src/
  pages/           # маршруты
  components/      # UI (auth, booking, notifications, owner, admin, pwa, seo)
  services/        # доменные сервисы
  lib/             # apiClient, IndexedDB stores, mappers
  hooks/           # React-хуки данных
database/migrations/
server/            # Express REST API
```

## Роли

| Роль | Доступ |
|------|--------|
| USER | кабинет, избранное, бронь, отчёты, форум, уведомления |
| OWNER | `/owner/*` — базы, аналитика, отзывы, брони, тариф, платежи, реклама |
| ADMIN | `/admin` — пользователи, заявки баз, отчёты, форум, тарифы, платежи, реклама |

Гейты: `RequireAuth`, `RequireRole` (`src/components/auth/RequireAuth.jsx`).

## Маршруты (ключевые)

Публичные: `/`, `/map`, `/bases/:id`, `/paid-bases/all`, `/free-places/all`, `/news/all`, `/news/:id`, `/reports`, `/reports/:id`, `/forum`, `/forum/:id`, `/calendar`, `/lunar`, `/directory`, `/favorites` (auth), `/login`, `/register`, `/u/:userId`, `*` → 404.

Кабинеты: `/cabinet/*`, `/owner/*`, `/admin` (вкладки: базы, отчёты, форум, тарифы, платежи, реклама, пользователи, настройки).

## Сценарии

### USER
Регистрация → профиль → поиск/карта → карточка базы → избранное → бронь → отчёт → комментарий/лайк → уведомления.

### OWNER
Регистрация (роль owner) → создание базы → submit на модерацию → после approve публикация → dashboard/аналитика → отзывы → тариф → оплата → заказ рекламы.

### ADMIN
Вход → вкладки: базы, отчёты, форум, тарифы, платежи, реклама, пользователи.

## Слои данных (local)

| Store | Назначение |
|-------|------------|
| `localAuthStore` | users, session, notifications prefs |
| `basesLocalDb` | черновики/модерация баз |
| `bookingsDb` | брони + availability |
| `socialDb` | отчёты + форум |
| `monetizationDb` | планы, платежи, подписки, ad_orders |
| `engagementDb` | избранное, achievements stats |
| `platformDb` | отзывы, analytics events |

## PWA / SEO

- Manifest + SW через `vite-plugin-pwa`
- Install prompt, offline.html, cache images/static
- `DocumentTitle`, `robots.txt`, `sitemap.xml`, OG-мета в `index.html`

## Известные ограничения

- Платежи ЮKassa/Robokassa: клиент создаёт `pending` + симулятор; секреты и webhook — Edge Functions.
- Часть каталога новостей/календаря может читать статические `src/data/*`, пока не включён remote service.
- Directory page historically использует локальные данные; сервис `directoryService` готов к Supabase.
