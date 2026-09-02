# PostgreSQL (standalone, без Supabase)

## Быстрый старт

1. Создайте БД на сервере:

```sql
CREATE USER rybalka WITH PASSWORD 'your_password';
CREATE DATABASE rybalka OWNER rybalka;
```

2. Примените миграции:

```bash
DATABASE_URL=postgresql://rybalka:your_password@localhost:5432/rybalka npm run db:migrate
```

3. Создайте администратора:

```bash
DATABASE_URL=... node database/scripts/seed-admin.mjs admin@example.com your_password
```

4. Запустите API:

```bash
npm run server:dev
```

5. В `.env` фронтенда:

```
VITE_USE_API=true
VITE_API_URL=          # пусто в dev (прокси Vite), в prod — URL API
```

## Структура

| Путь | Назначение |
|------|------------|
| `database/migrations/` | SQL-миграции (бывшие supabase/migrations, без RLS/Storage) |
| `database/migrate.mjs` | Применение миграций |
| `database/scripts/seed-admin.mjs` | Создание admin-пользователя |
| `server/` | Node.js REST API (Express + pg) |
| `uploads/` | Файлы (вместо Supabase Storage) |

## Отличия от Supabase

- **Auth**: JWT + bcrypt в `server/routes/auth.js` (таблица `users.password_hash`)
- **Storage**: локальная папка `uploads/` + раздача через `/uploads/*`
- **RLS**: не используется — права проверяются в API
- **Папка `supabase/`**: устарела, оставлена для справки; используйте `database/`

## Production

- Nginx: фронт `dist/`, API прокси на `localhost:3001`, `/uploads` на API
- `JWT_SECRET` и `DATABASE_URL` только на сервере
- Регулярные бэкапы Postgres
