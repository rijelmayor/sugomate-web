-- Run after applying 20261104180000_security_authorization_hardening.
-- These are catalog/privilege assertions; authenticated behavior must also be
-- exercised with dedicated disposable test users in an integration environment.

do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'SEC-001: profiles UPDATE must remain unavailable to anon/authenticated';
  end if;

  if has_column_privilege('anon', 'public.profiles', 'phone_verified_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'phone_verified_at', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE') then
    raise exception 'SEC-001: protected profile column UPDATE must remain unavailable';
  end if;

  if has_table_privilege('anon', 'public.merchants', 'UPDATE')
     or has_table_privilege('authenticated', 'public.merchants', 'UPDATE') then
    raise exception 'SEC-002: merchants UPDATE must remain unavailable to anon/authenticated';
  end if;

  if has_column_privilege('anon', 'public.merchants', 'owner_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.merchants', 'owner_id', 'UPDATE')
     or has_column_privilege('anon', 'public.merchants', 'status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.merchants', 'status', 'UPDATE')
     or has_column_privilege('anon', 'public.merchants', 'reviewed_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.merchants', 'reviewed_at', 'UPDATE')
     or has_column_privilege('anon', 'public.merchants', 'reviewed_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.merchants', 'reviewed_by', 'UPDATE') then
    raise exception 'SEC-002: protected merchant column UPDATE must remain unavailable';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'profiles_guard_sensitive_fields'
      and not tgisinternal
  ) then
    raise exception 'SEC-001: profile sensitive-field trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.merchants'::regclass
      and tgname = 'merchants_guard_approval_fields'
      and not tgisinternal
  ) then
    raise exception 'SEC-002: merchant approval-field trigger is missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'guard_profile_sensitive_fields'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'SEC-001: profile guard must be SECURITY DEFINER with empty search_path';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'guard_merchant_approval_fields'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'SEC-002: merchant guard must be SECURITY DEFINER with empty search_path';
  end if;
end;
$$;
