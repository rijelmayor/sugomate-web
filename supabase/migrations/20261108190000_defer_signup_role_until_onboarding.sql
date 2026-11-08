-- New signups receive a profile but no business role.
-- A role is added only when the user completes the corresponding onboarding flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_municipality uuid;
begin
  if nullif(new.raw_user_meta_data ->> 'municipality_id','') is not null then
    begin
      v_municipality := (new.raw_user_meta_data ->> 'municipality_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Choose a valid residential municipality.';
    end;
    if not exists(select 1 from public.municipalities m where m.id=v_municipality and m.is_serviceable=true) then
      raise exception 'Choose an active residential municipality.';
    end if;
  end if;
  insert into public.profiles (id,display_name,phone,municipality_id)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name',new.raw_user_meta_data ->> 'full_name')),''),
    nullif(trim(new.phone),''),
    v_municipality
  );
  return new;
end;
$function$;

create or replace function public.activate_customer_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to continue.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.phone_verified_at is not null
  ) then
    raise exception 'Verify your mobile number before completing account setup.';
  end if;
  if exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id and ur.role in ('admin','driver','merchant')
  ) then
    raise exception 'This account already has an operational role.';
  end if;
  insert into public.user_roles(user_id, role)
  values (v_user_id, 'customer')
  on conflict (user_id, role) do nothing;
end;
$function$;

revoke all on function public.activate_customer_account() from public;
grant execute on function public.activate_customer_account() to authenticated;
