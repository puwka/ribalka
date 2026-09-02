-- Step 2/2: moderation columns + owner notifications (no Supabase RLS)

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
