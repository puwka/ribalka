-- =============================================================================
-- Выдать роль admin уже существующему пользователю (по email)
-- Замените email ниже на свой.
-- =============================================================================

do $$
declare
  v_email text := 'ВАШ_EMAIL@example.com';  -- <-- замените
  v_user_id uuid;
begin
  select id into v_user_id
  from public.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    -- иногда запись есть только в auth
    select id into v_user_id
    from auth.users
    where lower(email) = lower(v_email)
    limit 1;
  end if;

  if v_user_id is null then
    raise exception 'User % not found. Register first, then run this script.', v_email;
  end if;

  update public.users
  set primary_role = 'admin', status = 'active', updated_at = now()
  where id = v_user_id;

  insert into public.user_roles (user_id, role_id)
  select v_user_id, r.id
  from public.roles r
  where r.code = 'admin'
  on conflict do nothing;

  raise notice 'Promoted % (id=%) to admin', v_email, v_user_id;
end $$;
