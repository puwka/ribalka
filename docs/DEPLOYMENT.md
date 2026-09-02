# Деплой

## Архитектура

| Компонент | Где |
|-----------|-----|
| SPA (React) | Статика `dist/` — Vercel, Nginx, CDN |
| REST API | Node.js `server/` — VPS рядом с Postgres |
| PostgreSQL | Ваш сервер |
| Файлы | `uploads/` на API-сервере |

Фронт и API можно разнести: в prod задайте `VITE_API_URL=https://api.example.com`.

## ENV

Скопируйте `.env.example` → `.env` (сервер) и `.env.local` (Vite). Секреты не коммитьте.

### Клиент (`VITE_*`)

| Переменная | Назначение |
|------------|------------|
| `VITE_USE_API` | `true` — auth, базы, новости через API; `false` — локальный IndexedDB |
| `VITE_API_URL` | URL API в prod; в dev можно пусто (прокси Vite → `:3001`) |
| `VITE_YANDEX_MAPS_API_KEY` | Яндекс.Карты |
| `VITE_YOOKASSA_SHOP_ID` | публичный shop id |
| `VITE_ROBOKASSA_MERCHANT_LOGIN` | логин магазина |
| `VITE_ROBOKASSA_IS_TEST` | `true` по умолчанию |
| `VITE_PAYMENT_RETURN_URL` | return URL после оплаты |
| `VITE_PAYMENTS_SIMULATE` | локальный checkout без ключей |

### API-сервер (только на VPS)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/rybalka` |
| `JWT_SECRET` | длинная случайная строка |
| `PORT` | по умолчанию `3001` |
| `UPLOAD_DIR` | папка загрузок, по умолчанию `./uploads` |
| `YOOKASSA_SECRET_KEY` | секрет ЮKassa |
| `ROBOKASSA_PASSWORD1` / `PASSWORD2` | подписи Robokassa |
| `RESEND_API_KEY` / `EMAIL_FROM` | email |

## База данных

```bash
npm run db:migrate
npm run db:seed-admin -- admin@example.com your_password
```

Подробнее: [database/README.md](../database/README.md).

## Локальная разработка (API + Postgres)

```bash
# Терминал 1 — API
DATABASE_URL=postgresql://... JWT_SECRET=dev npm run server:dev

# Терминал 2 — фронт
# .env.local: VITE_USE_API=true
npm run dev
```

Vite проксирует `/api` и `/uploads` на `localhost:3001`.

## Сборка фронта

```bash
npm ci
npm run lint
npm run build
```

Артефакт: `dist/`.

## Production на VPS (рекомендуется)

1. PostgreSQL + `npm run db:migrate`
2. API: `pm2 start npm --name rybalka-api -- run server:start`
3. Nginx:

```nginx
# Статика фронта
server {
  listen 443 ssl;
  server_name example.com;
  root /var/www/rybalka/dist;
  location / { try_files $uri $uri/ /index.html; }
}

# API (или тот же server с location /api)
server {
  listen 443 ssl;
  server_name api.example.com;
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

4. Сборка фронта с `VITE_USE_API=true` и `VITE_API_URL=https://api.example.com`

## Vercel (только статика)

Vercel подходит для SPA. API и Postgres — на отдельном VPS.

Переменные в Vercel:

| Name | Value |
|------|--------|
| `VITE_USE_API` | `true` |
| `VITE_API_URL` | `https://api.example.com` |
| `VITE_YANDEX_MAPS_API_KEY` | ключ карт |

## Интеграции

| Сервис | Где ключ | Обязателен |
|--------|---------|------------|
| PostgreSQL + API | server ENV | для prod |
| Яндекс.Карты | `VITE_YANDEX_MAPS_API_KEY` | для `/map` |
| ЮKassa | shop id + secret (server) | для платежей |
| Robokassa | login + passwords (server) | альтернатива |
| Resend/SMTP | server | email |
| Open-Meteo | не нужен | погода |

## PWA

HTTPS обязателен (кроме localhost). После деплоя проверьте install и offline.
