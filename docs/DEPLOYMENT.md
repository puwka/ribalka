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
| `RESEND_API_KEY` | ключ Resend (обязателен для писем в prod) |
| `EMAIL_FROM` | `Рыбалка Прикамье <noreply@ваш-домен.ru>` — домен verified в Resend |
| `ADMIN_NOTIFY_EMAIL` | почта админа для модерации |
| `PUBLIC_SITE_URL` | `https://ваш-домен.ru` — ссылки в письмах |

### Почта (Resend) на VPS

1. В `.env` на VPS (корне проекта, рядом с `package.json`):

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=Aktiv59 <noreply@aktiv59.ru>
ADMIN_NOTIFY_EMAIL=mokrushinmix@yandex.ru
PUBLIC_SITE_URL=https://aktiv59.ru
```

Имя в `EMAIL_FROM` лучше латиницей — так меньше проблем с кодировкой `.env` и спам-фильтрами. Домен должен быть **Verified** в [Resend → Domains](https://resend.com/domains).

2. Перезапуск API: `pm2 restart rybalka-api`

3. Проверка:

```bash
curl -s https://aktiv59.ru/api/health
# mailConfigured: true
```

В [Resend → Emails](https://resend.com/emails) смотрите `delivered` / `bounced` / `complained`. Если `delivered`, а письма нет — проверьте **Спам** в Яндексе и добавьте `noreply@aktiv59.ru` в контакты.

Тестовое письмо (JWT админа): `POST /api/users/mail-test` с телом `{"to":"ваш@email.ru"}`.

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
3. Nginx (важно для SEO — реальный HTTP 404):

Не используйте слепой `try_files … /index.html` на все URL: Яндекс видит soft-404 (код 200 на несуществующие страницы).

Готовый конфиг: [`deploy/nginx-aktiv59.conf`](../deploy/nginx-aktiv59.conf).

Суть:

```nginx
map $uri $spa_try {
    default /__spa_404;
    ~*^/$ /index.html;
    ~*^/(about|map|tariffs|…|cabinet|owner|admin)(/|$) /index.html;
    # полный список — в deploy/nginx-aktiv59.conf
}

location / {
    try_files $uri $uri/ $spa_try;
}
location = /__spa_404 {
    internal;
    return 404;
}
# Оболочка SPA со статусом 404 (не soft-404 с кодом 200)
error_page 404 =404 /index.html;
```

После правки:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://aktiv59.ru/no-such-page | head -1   # HTTP/1.1 404
curl -sI https://aktiv59.ru/forum | head -1          # HTTP/1.1 200
```

PWA / статика:

```nginx
  # PWA: sw / manifest / shell — без долгого кэша, иначе приложение «не обновляется»
  location = /sw.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    add_header Service-Worker-Allowed "/";
    try_files $uri =404;
  }
  location ~* ^/workbox-.*\.js$ {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }
  location = /manifest.webmanifest {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }
  location = /index.html {
    add_header Cache-Control "public, max-age=0, must-revalidate";
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }
```

Полный пример с `/api` и `/uploads` — в `deploy/nginx-aktiv59.conf`.

4. Сборка фронта с `VITE_USE_API=true` и `VITE_API_URL=https://aktiv59.ru`

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
