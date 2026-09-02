# Рыбалка в Прикамье

SPA-платформа о рыбалке и отдыхе в Пермском крае: каталог баз, карта, отчёты, форум, бронирование, лунный календарь, кабинеты USER / OWNER / ADMIN, монетизация и PWA.

## Стек

- React 19 + Vite 8 + React Router 7
- **Production:** PostgreSQL + Node.js REST API (`server/`, `database/`)
- **Локальный режим:** IndexedDB / localStorage (`VITE_USE_API=false`)
- PWA: `vite-plugin-pwa` + Workbox

## Быстрый старт (локально без сервера)

```bash
npm install
cp .env.example .env
# VITE_USE_API=false — демо на IndexedDB
npm run dev
```

Демо-аккаунты (только при `VITE_USE_API=false`):

| Роль  | Email             | Пароль   |
|-------|-------------------|----------|
| USER  | user@demo.local   | demo1234 |
| OWNER | owner@demo.local  | demo1234 |
| ADMIN | admin@demo.local  | demo1234 |

## Production (Postgres + API)

```bash
npm run db:migrate          # DATABASE_URL в окружении
npm run db:seed-admin -- admin@example.com password
npm run server:dev          # API на :3001
# VITE_USE_API=true в .env.local
npm run dev
```

См. [database/README.md](database/README.md) и [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev-сервер Vite |
| `npm run build` | Production-сборка |
| `npm run server:dev` | API с hot-reload |
| `npm run server:start` | API (prod) |
| `npm run db:migrate` | Миграции Postgres |
| `npm run db:seed-admin` | Создать admin |
| `npm run lint` | oxlint |

## Документация

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [database/README.md](database/README.md)

## Режимы данных

| `VITE_USE_API` | Auth | Базы / новости | Остальное |
|----------------|------|----------------|-----------|
| `false` | localStorage | IndexedDB | IndexedDB |
| `true` | JWT API | REST API | пока IndexedDB (отчёты, CMS, admin CRUD — в roadmap) |

Supabase удалён; миграции перенесены в `database/migrations/`.
