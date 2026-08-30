-- =============================================================================
-- Тестовый администратор для Supabase (SQL Editor)
-- Email:    admin@demo.local
-- Password: demo1234
--
-- Запускать в Dashboard → SQL Editor от роли postgres / service_role.
-- НЕ использовать на production с этим паролем.
-- =============================================================================

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'admin@demo.local';
  v_password text := 'demo1234';
  v_display_name text := 'Админ';
  v_existing uuid;
begin
  -- Если пользователь уже есть — только выдаём роль admin
  select id into v_existing
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_existing is not null then
    v_user_id := v_existing;
    raise notice 'User % already exists (id=%). Promoting to admin…', v_email, v_user_id;
  else
    -- 1) auth.users
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_display_name),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false
    );

    -- 2) auth.identities (нужен для входа по email/password)
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );

    raise notice 'Created auth user % (id=%).', v_email, v_user_id;
  end if;

  -- 3) public.users / profiles создаются триггером handle_new_auth_user.
  --    На случай гонки/старого пользователя — upsert вручную.
  insert into public.users (id, email, status, primary_role, referral_code)
  values (
    v_user_id,
    v_email,
    'active',
    'admin',
    lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  on conflict (id) do update
  set
    email = excluded.email,
    status = 'active',
    primary_role = 'admin',
    updated_at = now();

  insert into public.profiles (user_id, display_name, is_public)
  values (v_user_id, v_display_name, true)
  on conflict (user_id) do update
  set display_name = excluded.display_name;

  -- 4) Роль user (если нет) + admin
  insert into public.user_roles (user_id, role_id)
  select v_user_id, r.id
  from public.roles r
  where r.code in ('user', 'admin')
  on conflict do nothing;

  raise notice 'Done. Login: % / %', v_email, v_password;
end $$;

-- Проверка
select
  u.id,
  u.email,
  u.primary_role,
  u.status,
  p.display_name,
  array_agg(r.code order by r.code) as roles
from public.users u
left join public.profiles p on p.user_id = u.id
left join public.user_roles ur on ur.user_id = u.id
left join public.roles r on r.id = ur.role_id
where lower(u.email) = 'admin@demo.local'
group by u.id, u.email, u.primary_role, u.status, p.display_name;
