-- Keep the authorization role table synchronized with operational account records.
create or replace function public.sync_merchant_member_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  if tg_op = 'INSERT' then
    insert into public.user_roles(user_id, role)
    values(new.user_id, 'merchant'::public.app_role)
    on conflict (user_id, role) do nothing;
    return new;
  end if;
  if not exists (select 1 from public.merchant_members where user_id = v_user_id)
     and not exists (select 1 from public.merchants where owner_id = v_user_id) then
    delete from public.user_roles
    where user_id = v_user_id and role = 'merchant'::public.app_role;
  end if;
  return old;
end;
$$;

create or replace function public.sync_driver_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_roles(user_id, role)
    values(new.user_id, 'driver'::public.app_role)
    on conflict (user_id, role) do nothing;
    return new;
  end if;
  delete from public.user_roles
  where user_id = old.user_id
    and role = 'driver'::public.app_role
    and not exists (select 1 from public.driver_profiles where user_id = old.user_id);
  return old;
end;
$$;

drop trigger if exists merchant_member_role_sync on public.merchant_members;
create trigger merchant_member_role_sync
after insert or delete on public.merchant_members
for each row execute function public.sync_merchant_member_role();

drop trigger if exists driver_profile_role_sync on public.driver_profiles;
create trigger driver_profile_role_sync
after insert or delete on public.driver_profiles
for each row execute function public.sync_driver_profile_role();

revoke all on function public.sync_merchant_member_role() from public, anon, authenticated;
revoke all on function public.sync_driver_profile_role() from public, anon, authenticated;

-- Backfill any existing operational profiles and memberships.
insert into public.user_roles(user_id, role)
select distinct mm.user_id, 'merchant'::public.app_role
from public.merchant_members mm
on conflict (user_id, role) do nothing;

insert into public.user_roles(user_id, role)
select dp.user_id, 'driver'::public.app_role
from public.driver_profiles dp
on conflict (user_id, role) do nothing;
