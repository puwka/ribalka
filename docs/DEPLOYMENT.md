# Деплой

## ENV

Скопируйте `.env.example` → `.env` / CI secrets.

### Клиент (`VITE_*`)

| Переменная | Назначение |
|------------|------------|
| `VITE_SUPABASE_URL` | URL проекта |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_USE_SUPABASE` | `true` / `false` |
| `VITE_YANDEX_MAPS_API_KEY` | Яндекс.Карты (HTTP referrer) |
| `VITE_YOOKASSA_SHOP_ID` | публичный shop id |
| `VITE_ROBOKASSA_MERCHANT_LOGIN` | логин магазина |
| `VITE_ROBOKASSA_IS_TEST` | `true` по умолчанию |
| `VITE_PAYMENT_RETURN_URL` | return URL после оплаты |
| `VITE_PAYMENTS_SIMULATE` | локальный checkout без ключей |

### Только сервер (НЕ `VITE_`)

| Переменная | Назначение |
|------------|------------|
| `YOOKASSA_SECRET_KEY` | секрет ЮKassa |
| `ROBOKASSA_PASSWORD1` / `PASSWORD2` | подписи Robokassa |
| `RESEND_API_KEY` / `EMAIL_FROM` | email |
| Supabase `service_role` | только Edge / backend |

## Сборка

```bash
npm ci
npm run lint
npm run build
```

Артефакт: папка `dist/` (статический хостинг + SPA fallback на `index.html`).

## Хостинг

Подходит: Vercel, Netlify, Cloudflare Pages, Nginx. В репозитории есть `vercel.json` (Vite + SPA fallback + кэш для `/assets`).

HTTPS обязателен для PWA install (кроме localhost).

### Vercel (рекомендуется)

1. Запушьте код на GitHub (см. ниже).
2. [vercel.com](https://vercel.com) → **Add New Project** → импорт репозитория.
3. Framework: **Vite** (подхватится из `vercel.json`). Build: `npm run build`, Output: `dist`.
4. **Environment Variables** (Production + Preview):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://….supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key |
| `VITE_USE_SUPABASE` | `true` |
| `VITE_YANDEX_MAPS_API_KEY` | ключ Яндекс.Карт |

5. Deploy. После первого деплоя добавьте домен Vercel в:
   - Supabase → Authentication → URL Configuration (`Site URL` + Redirect URLs)
   - Яндекс.Кабинет → HTTP Referrer для ключа карт

`.env` в git не коммитьте — только переменные в панели Vercel.

### GitHub: первый пуш из консоли (PowerShell)

```powershell
cd c:\Users\maks\Desktop\rybalka-main

git init
git add .
git commit -m "Initial commit: fishing platform ready for Vercel"

# Создайте пустой репозиторий на github.com, затем:
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git
git push -u origin main
```

Если репозиторий уже есть и remote настроен:

```powershell
git add .
git commit -m "Prepare Vercel deploy"
git push
```

CLI через GitHub (опционально, нужен `gh auth login`):

```powershell
gh repo create rybalka --private --source=. --remote=origin --push
```

Nginx пример:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Supabase

1. Создать проект
2. `supabase db push` (все миграции по порядку)
3. Включить Auth email/password
4. Заполнить `VITE_SUPABASE_*` и `VITE_USE_SUPABASE=true`
5. (Опционально) задеплоить Edge Functions из `supabase/functions/`

## Интеграции с API-ключами

| Сервис | Где ключ | Обязателен |
|--------|---------|------------|
| Supabase | `VITE_SUPABASE_*` | для cloud-режима |
| Яндекс.Карты | `VITE_YANDEX_MAPS_API_KEY` | для `/map` |
| ЮKassa | shop id + secret (server) | для реальных платежей |
| Robokassa | login + passwords (server) | альтернатива платежам |
| Resend/SMTP | server | email-дайджесты |
| Open-Meteo | не нужен | погода |

## PWA на телефоне

1. Задеплоить на HTTPS
2. Android Chrome → «Установить приложение»
3. iOS Safari → Поделиться → «На экран Домой»
4. Проверить offline после первого визита
