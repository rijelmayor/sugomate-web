-- Defense-in-depth authorization for profile verification and merchant approval fields.
-- Current live grants already deny UPDATE to anon/authenticated; these triggers
-- ensure protected fields remain guarded if ordinary profile-edit grants are
-- introduced in a future iteration.

create or replace function app_private.guard_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_jwt_role text;
begin
  v_uid := auth.uid();
  v_jwt_role := current_setting('request.jwt.claim.role', true);

  if v_jwt_role = 'service_role' then
    return new;
  end if;

  if v_uid is not null
     and app_private.has_role(v_uid, 'admin'::public.app_role) then
    return new;
  end if;

  if old.status is distinct from new.status
     or old.phone_verified_at is distinct from new.phone_verified_at then
    raise exception using
      errcode = '42501',
      message = 'Only an administrator or trusted server process may change protected profile fields';
  end if;

  return new;
end;
$$;

create or replace function app_private.guard_merchant_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_jwt_role text;
begin
  v_uid := auth.uid();
  v_jwt_role := current_setting('request.jwt.claim.role', true);

  if v_jwt_role = 'service_role' then
    return new;
  end if;

  if v_uid is not null
     and app_private.has_role(v_uid, 'admin'::public.app_role) then
    return new;
  end if;

  if old.owner_id is distinct from new.owner_id
     or old.status is distinct from new.status
     or old.reviewed_at is distinct from new.reviewed_at
     or old.reviewed_by is distinct from new.reviewed_by then
    raise exception using
      errcode = '42501',
      message = 'Only an administrator or trusted server process may change merchant ownership or approval fields';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_fields on public.profiles;
create trigger profiles_guard_sensitive_fields
before update on public.profiles
for each row execute function app_private.guard_profile_sensitive_fields();

drop trigger if exists merchants_guard_approval_fields on public.merchants;
create trigger merchants_guard_approval_fields
before update on public.merchants
for each row execute function app_private.guard_merchant_approval_fields();

-- Keep direct Data API writes disabled. Future editable fields must be granted
-- individually after the UI and server-side validation are implemented.
revoke update on table public.profiles from public, anon, authenticated;
revoke update (status, phone_verified_at) on table public.profiles from public, anon, authenticated;
revoke update on table public.merchants from public, anon, authenticated;
revoke update (owner_id, status, reviewed_at, reviewed_by) on table public.merchants from public, anon, authenticated;

-- Trigger functions are internal implementation details, not RPC endpoints.
revoke all on function app_private.guard_profile_sensitive_fields() from public, anon, authenticated;
revoke all on function app_private.guard_merchant_approval_fields() from public, anon, authenticated;
