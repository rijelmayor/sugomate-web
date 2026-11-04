-- SUGOMATE delivery partner dispatch, availability and proof-of-delivery workflow.
-- Apply after the customer order engine and admin control center migrations.

alter table public.orders
  add column if not exists driver_user_id uuid references auth.users(id),
  add column if not exists driver_assignment_status text
    check (driver_assignment_status in ('offered','accepted')),
  add column if not exists assigned_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_proof_path text,
  add column if not exists driver_note text;

alter table public.driver_profiles
  add column if not exists is_available boolean not null default false,
  add column if not exists last_seen_at timestamptz;

create index if not exists orders_driver_queue_idx
  on public.orders(driver_user_id, status, placed_at desc);
create index if not exists orders_dispatch_queue_idx
  on public.orders(status, placed_at asc)
  where status = 'ready_for_pickup' and driver_user_id is null;

drop policy if exists "Drivers read assigned orders" on public.orders;
create policy "Drivers read assigned orders" on public.orders
 for select to authenticated using (
  driver_user_id = (select auth.uid())
  and exists (
    select 1 from public.driver_profiles dp
    where dp.user_id = (select auth.uid()) and dp.status = 'active'
  )
 );

drop policy if exists "Assigned drivers read order items" on public.order_items;
create policy "Assigned drivers read order items" on public.order_items
 for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.driver_user_id = (select auth.uid())
  )
 );

drop policy if exists "Assigned drivers read order history" on public.order_status_history;
create policy "Assigned drivers read order history" on public.order_status_history
 for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id and o.driver_user_id = (select auth.uid())
  )
 );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Drivers upload own delivery proof" on storage.objects;
create policy "Drivers upload own delivery proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and name like (select auth.uid()::text) || '/%'
  and exists (
    select 1 from public.orders o
    where o.id::text = split_part(name, '/', 2)
      and o.driver_user_id = (select auth.uid())
      and o.status = 'in_transit'
  )
);

drop policy if exists "Drivers and admins read delivery proof" on storage.objects;
create policy "Drivers and admins read delivery proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    name like (select auth.uid()::text) || '/%'
    or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
  )
);

create or replace function public.admin_assign_order_to_driver(
  p_order_id uuid,
  p_driver_user_id uuid
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'ready_for_pickup' or v_order.driver_user_id is not null then
    raise exception 'Only unassigned orders ready for pickup can be dispatched.';
  end if;
  if not exists (
    select 1 from public.driver_profiles dp
    where dp.user_id = p_driver_user_id and dp.status = 'active' and dp.is_available = true
  ) then raise exception 'Choose an approved driver who is currently online.'; end if;

  update public.orders
  set driver_user_id = p_driver_user_id,
      driver_assignment_status = 'offered',
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,'assigned',v_actor,'Dispatch offer sent to delivery partner');
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'driver_assigned','orders',p_order_id::text,
    jsonb_build_object('driver_user_id',p_driver_user_id,'order_number',v_order.order_number));
end;
$$;

create or replace function public.driver_set_availability(p_is_available boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists (select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'Only approved delivery partners can change availability.';
  end if;
  if not p_is_available and exists (
    select 1 from public.orders
    where driver_user_id=v_actor and status in ('assigned','picked_up','in_transit')
  ) then raise exception 'Complete or resolve your active delivery before going offline.'; end if;
  update public.driver_profiles
  set is_available=p_is_available,last_seen_at=now(),updated_at=now()
  where user_id=v_actor and status='active';
end;
$$;

create or replace function public.driver_respond_to_assignment(
  p_order_id uuid,
  p_accept boolean
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists (select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders
  where id=p_order_id and driver_user_id=v_actor
  for update;
  if not found or v_order.status <> 'assigned' or v_order.driver_assignment_status <> 'offered' then
    raise exception 'This delivery offer is no longer available.';
  end if;
  if p_accept then
    update public.orders set driver_assignment_status='accepted',updated_at=now() where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','assigned',v_actor,'Delivery partner accepted assignment');
  else
    update public.orders
    set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
        assigned_at=null,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','ready_for_pickup',v_actor,'Delivery partner declined assignment; returned to dispatch queue');
  end if;
end;
$$;

create or replace function public.driver_update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_proof_path text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_valid boolean := false;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists (select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders
  where id=p_order_id and driver_user_id=v_actor
  for update;
  if not found then raise exception 'Assigned order not found.'; end if;

  v_valid :=
    (v_order.status='assigned' and v_order.driver_assignment_status='accepted' and p_next_status='picked_up')
    or (v_order.status='picked_up' and p_next_status='in_transit')
    or (v_order.status='in_transit' and p_next_status='delivered');
  if not v_valid then raise exception 'This delivery cannot move to the requested status.'; end if;

  if p_next_status='delivered' then
    if p_proof_path is null
       or p_proof_path not like v_actor::text || '/' || p_order_id::text || '/%'
       or not exists (
         select 1 from storage.objects so
         where so.bucket_id='delivery-proofs' and so.name=p_proof_path
       ) then raise exception 'Upload a valid delivery photo before completing the order.'; end if;
  end if;

  update public.orders
  set status=p_next_status,
      picked_up_at=case when p_next_status='picked_up' then now() else picked_up_at end,
      delivered_at=case when p_next_status='delivered' then now() else delivered_at end,
      delivery_proof_path=case when p_next_status='delivered' then p_proof_path else delivery_proof_path end,
      driver_note=coalesce(nullif(left(coalesce(p_note,''),500),''),driver_note),
      updated_at=now()
  where id=p_order_id;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,p_next_status,v_actor,
    coalesce(nullif(left(coalesce(p_note,''),500),''),case when p_next_status='delivered' then 'Delivery completed with photo proof' else 'Delivery status updated by partner' end));
end;
$$;

revoke all on function public.admin_assign_order_to_driver(uuid,uuid) from public,anon;
revoke all on function public.driver_set_availability(boolean) from public,anon;
revoke all on function public.driver_respond_to_assignment(uuid,boolean) from public,anon;
revoke all on function public.driver_update_order_status(uuid,text,text,text) from public,anon;
grant execute on function public.admin_assign_order_to_driver(uuid,uuid) to authenticated;
grant execute on function public.driver_set_availability(boolean) to authenticated;
grant execute on function public.driver_respond_to_assignment(uuid,boolean) to authenticated;
grant execute on function public.driver_update_order_status(uuid,text,text,text) to authenticated;
