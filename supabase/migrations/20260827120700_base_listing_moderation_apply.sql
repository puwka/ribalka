-- Step 2/2: use "approved" only after it was committed in the previous migration.

-- Prefer approved for fishing bases (keep published for news/forum)
update public.bases
set status = 'approved'
where status = 'published';

alter table public.bases
  add column if not exists contacts text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists conditions text,
  add column if not exists features text,
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.users (id) on delete set null;

drop index if exists bases_published_idx;
create index if not exists bases_approved_idx
  on public.bases (published_at desc)
  where status = 'approved';

create index if not exists bases_moderation_idx
  on public.bases (status, submitted_at desc)
  where status in ('pending', 'rejected', 'draft');

drop policy if exists bases_select_published_or_owner on public.bases;
drop policy if exists bases_select_approved_or_owner on public.bases;
create policy bases_select_approved_or_owner on public.bases
  for select using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin()
  );

create or replace function public.enforce_base_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.status = 'approved' and old.status is distinct from 'approved' then
      new.published_at := coalesce(new.published_at, now());
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
      new.rejection_reason := null;
    elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    elsif new.status = 'archived' then
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
    return new;
  end if;

  if old.owner_id = auth.uid() then
    if old.status in ('draft', 'rejected') and new.status in ('draft', 'pending') then
      if new.status = 'pending' then
        new.submitted_at := now();
        new.rejection_reason := null;
      end if;
      if new.status in ('approved', 'archived') then
        raise exception 'Owners cannot approve or archive bases';
      end if;
      return new;
    end if;

    if old.status = 'pending' and new.status = 'pending' then
      raise exception 'Pending bases can only be changed by admin';
    end if;

    if old.status = 'approved' then
      if new is distinct from old then
        raise exception 'Approved bases can only be changed by admin';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bases_enforce_status on public.bases;
create trigger bases_enforce_status
before update on public.bases
for each row execute function public.enforce_base_status_transition();

create or replace function public.notify_base_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status in ('approved', 'rejected')
     and new.owner_id is not null then
    insert into public.notifications (user_id, type, title, body, link_path, payload)
    values (
      new.owner_id,
      'moderation',
      case when new.status = 'approved' then 'База одобрена' else 'База отклонена' end,
      case
        when new.status = 'approved' then format('«%s» опубликована на сайте.', new.name)
        else format('«%s» отклонена. Причина: %s', new.name, coalesce(new.rejection_reason, 'не указана'))
      end,
      '/owner/bases',
      jsonb_build_object('base_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bases_notify_moderation on public.bases;
create trigger bases_notify_moderation
after update on public.bases
for each row execute function public.notify_base_moderation();
