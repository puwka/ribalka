# Рыбалка в Прикамье

SPA-платформа о рыбалке и отдыхе в Пермском крае: каталог баз, карта, отчёты, форум, бронирование, лунный календарь, кабинеты USER / OWNER / ADMIN, монетизация и PWA.

## Стек

- React 19 + Vite 8 + React Router 7
- Supabase (Auth + Postgres + Storage + RLS) при `VITE_USE_SUPABASE=true`
- Локальный режим: IndexedDB / localStorage (auth, базы, соцслой, брони, монетизация)
- PWA: `vite-plugin-pwa` + Workbox

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполните ключи
npm run dev
```

Демо-аккаунты (только при `VITE_USE_SUPABASE=false`):

| Роль  | Email             | Пароль   |
|-------|-------------------|----------|
| USER  | user@demo.local   | demo1234 |
| OWNER | owner@demo.local  | demo1234 |
| ADMIN | admin@demo.local  | demo1234 |

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev-сервер |
| `npm run build` | Production-сборка (+ SW/manifest) |
| `npm run preview` | Просмотр `dist/` |
| `npm run lint` | oxlint |
| `npm run verify:auth` | Проверка ролей (local) |

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — слои, роли, сценарии
- [docs/DATABASE.md](docs/DATABASE.md) — миграции и хранилища
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — деплой, ENV, интеграции

## Production build

```bash
npm run build
npm run preview -- --host
```

Сборка должна завершаться без ошибок. PWA-артефакты: `dist/sw.js`, `dist/manifest.webmanifest`, `dist/icons/*`.

## Реализовано

- Роли USER / OWNER / ADMIN, кабинеты, модерация баз
- Каталог, карта, `/bases/:id`, поиск → карточка базы
- Избранное, бронирования, отчёты, форум, достижения
- Уведомления + PWA (install, offline, SW)
- Монетизация: тарифы, платежи (симулятор / архитектура ЮKassa·Robokassa), реклама
- SEO: title, OG, robots, sitemap
- Документация: `docs/ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md`

## Гибридный режим данных

При `VITE_USE_SUPABASE=true` auth и каталог баз идут в Supabase. Избранное, брони, соцслой, аналитика owner и монетизация UI пока на IndexedDB (см. ARCHITECTURE). Для полного локального демо: `VITE_USE_SUPABASE=false`.

## Изменения аудита (ключевые)

- `/news/all` до `/news/:id`; 404; `/bases/:id`
- Мобильный auth в burger-меню
- `assertAdmin` через сессию Supabase + local
- Симуляция оплаты только владельцу платежа + `VITE_PAYMENTS_SIMULATE`
- RLS media: миграция `20260827121300_fix_base_media_rls_approved.sql`
- Admin: пользователи из Supabase, вкладка «Настройки»
