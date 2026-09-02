-- Honor requested_role=owner from signup metadata (admin still only via staff)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_code text;
  v_role public.app_role;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1),
    'Рыболов'
  );
  v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  v_role := case
    when coalesce(new.raw_user_meta_data->>'requested_role', 'user') = 'owner'
      then 'owner'::public.app_role
    else 'user'::public.app_role
  end;

  insert into public.users (id, email, referral_code, primary_role)
  values (new.id, new.email, v_code, v_role);

  insert into public.profiles (user_id, display_name)
  values (new.id, v_name);

  -- always grant base user role
  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.code = 'user'
  on conflict do nothing;

  if v_role = 'owner' then
    insert into public.user_roles (user_id, role_id)
    select new.id, r.id from public.roles r where r.code = 'owner'
    on conflict do nothing;
  end if;

  return new;
end;
$$;
