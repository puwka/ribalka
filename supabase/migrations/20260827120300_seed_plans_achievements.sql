-- Seed plans + starter achievements (no secrets, no fake admin password)

insert into public.plans (code, name, description, price_month, target_role, features) values
  (
    'owner_basic',
    'База — Старт',
    'Публикация одной платной базы, базовые заявки на бронирование',
    990,
    'owner',
    '["1_base","bookings","basic_analytics"]'::jsonb
  ),
  (
    'owner_pro',
    'База — Про',
    'Несколько баз, приоритет в поиске, расширенная аналитика',
    2490,
    'owner',
    '["unlimited_bases","bookings","priority_listing","analytics","ads_discount"]'::jsonb
  ),
  (
    'user_plus',
    'Рыболов Plus',
    'Расширенные отчёты, бейджи, приоритет в форуме',
    299,
    'user',
    '["extra_report_media","badge","forum_priority"]'::jsonb
  )
on conflict (code) do nothing;

insert into public.achievements (code, name, description, points) values
  ('first_report', 'Первый отчёт', 'Опубликовали первый отчёт о рыбалке', 10),
  ('first_review', 'Первый отзыв', 'Оставили отзыв о базе', 5),
  ('first_booking', 'Первое бронирование', 'Забронировали отдых на базе', 15),
  ('social_angler', 'Общительный рыболов', '10 комментариев на платформе', 20),
  ('map_explorer', 'Исследователь', 'Добавили 5 мест в избранное', 10)
on conflict (code) do nothing;
