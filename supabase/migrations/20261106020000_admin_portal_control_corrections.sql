-- Admin portal corrections: scoped merchant category assignment and safe driver suspension.
create or replace function public.admin_assign_merchant_category(
  p_merchant_id uuid,
  p_category_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old_category uuid;
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;

  select category_id into v_old_category
  from public.merchants
  where id = p_merchant_id
  for update;

  if not found then
    raise exception 'Merchant not found.';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.merchant_categories
    where id = p_category_id and is_active = true
  ) then
    raise exception 'Choose an active business category.';
  end if;

  update public.merchants
  set category_id = p_category_id, updated_at = now()
  where id = p_merchant_id;

  insert into public.audit_logs(actor_id, action, entity_table, entity_id, details)
  values (
    v_actor,
    'merchant_category_assigned',
    'merchants',
    p_merchant_id::text,
    jsonb_build_object('from_category_id', v_old_category, 'to_category_id', p_category_id)
  );
end;
$$;

revoke all on function public.admin_assign_merchant_category(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_merchant_category(uuid, uuid) to authenticated;

-- Any driver moved away from active status is forced offline immediately.
create or replace function public.admin_review_driver(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old text;
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if p_status not in ('active', 'rejected', 'suspended', 'pending') then
    raise exception 'Invalid driver status.';
  end if;

  select status::text into v_old
  from public.driver_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Driver application not found.';
  end if;

  if p_status <> 'active' and exists (
    select 1 from public.orders
    where driver_user_id = p_user_id
      and status in ('assigned', 'picked_up', 'in_transit')
  ) then
    raise exception 'Driver has an active delivery. Resolve or reassign it before changing account status.';
  end if;

  update public.driver_profiles
  set status = p_status::public.account_status,
      is_available = case when p_status = 'active' then is_available else false end,
      reviewed_at = now(),
      reviewed_by = v_actor,
      updated_at = now()
  where user_id = p_user_id;

  if p_status = 'active' then
    insert into public.user_roles(user_id, role, assigned_by)
    values(p_user_id, 'driver'::public.app_role, v_actor)
    on conflict(user_id, role) do nothing;
  end if;

  insert into public.audit_logs(actor_id, action, entity_table, entity_id, details)
  values(v_actor, 'driver_status_changed', 'driver_profiles', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

revoke all on function public.admin_review_driver(uuid, text) from public, anon;
grant execute on function public.admin_review_driver(uuid, text) to authenticated;
