-- SUGOMATE testing dispatch: global driver order board with opt-in claiming.
-- GPS is deliberately not part of availability, visibility, or claim authorization.
-- Merchants only begin preparation after a driver has claimed an accepted order.

drop policy if exists "Active drivers read ready pickup orders" on public.orders;
create policy "Active drivers read claimable orders"
on public.orders for select to authenticated
using (
  status in ('accepted','ready_for_pickup')
  and driver_user_id is null
  and exists (
    select 1 from public.driver_profiles dp
    where dp.user_id = (select auth.uid())
      and dp.status = 'active'
      and dp.is_available = true
  )
);

create or replace function public.driver_claim_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_driver public.driver_profiles%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;

  -- Serialize claims made by the same driver so one rider cannot claim two
  -- orders concurrently from two browser tabs.
  select * into v_driver
  from public.driver_profiles
  where user_id = v_actor and status = 'active' and is_available = true
  for update;
  if not found then raise exception 'You must be online as an approved driver to claim an order.'; end if;

  if exists (
    select 1 from public.orders o
    where o.driver_user_id = v_actor
      and o.status in ('accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit')
  ) then
    raise exception 'Finish your current delivery before claiming another order.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status not in ('accepted','ready_for_pickup') or v_order.driver_user_id is not null then
    raise exception 'This order is no longer available. Refresh the order list.';
  end if;

  -- Keep the merchant's order stage intact: accepted means the merchant has
  -- accepted the customer order; ready_for_pickup remains ready if legacy data.
  update public.orders
  set driver_user_id = v_actor,
      driver_assignment_status = 'accepted',
      assigned_at = now(),
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values (p_order_id,v_order.status,v_order.status,v_actor,'Delivery partner claimed the order; merchant may begin preparation');
end;
$$;

-- A merchant may only start preparing after a rider has claimed the order.
create or replace function public.merchant_update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_allowed boolean := false;
begin
  if v_actor is null then raise exception 'You must be signed in.'; end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
    and exists (
      select 1 from public.merchant_members mm
      where mm.merchant_id = o.merchant_id and mm.user_id = v_actor
    )
    and exists (
      select 1 from public.merchants m
      where m.id = o.merchant_id and m.status = 'approved'
    )
  for update;

  if not found then raise exception 'Order not found or you do not have permission to manage it.'; end if;

  v_allowed :=
    (v_order.status = 'pending_merchant' and p_next_status in ('accepted','rejected'))
    or (v_order.status = 'accepted' and p_next_status = 'preparing' and v_order.driver_user_id is not null)
    or (v_order.status = 'preparing' and p_next_status = 'ready_for_pickup');

  if not v_allowed then
    if v_order.status = 'accepted' and p_next_status = 'preparing' and v_order.driver_user_id is null then
      raise exception 'Wait until a delivery partner claims this order before starting preparation.';
    end if;
    raise exception 'This order cannot be moved to the requested status.';
  end if;

  update public.orders set status = p_next_status, updated_at = now() where id = p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,p_next_status,v_actor,nullif(left(coalesce(p_note,''),300),''));
end;
$$;

-- Pickup can only be confirmed once the merchant marks the order ready.
create or replace function public.driver_update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_proof_path text default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = ''
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
    (v_order.status='ready_for_pickup' and v_order.driver_assignment_status='accepted' and p_next_status='picked_up')
    or (v_order.status='assigned' and v_order.driver_assignment_status='accepted' and p_next_status='picked_up')
    or (v_order.status='picked_up' and p_next_status='in_transit')
    or (v_order.status='in_transit' and p_next_status='delivered');
  if not v_valid then raise exception 'Wait for the merchant to mark the order ready, or check the current delivery status.'; end if;

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

revoke all on function public.driver_claim_order(uuid) from public,anon;
revoke all on function public.merchant_update_order_status(uuid,text,text) from public,anon;
revoke all on function public.driver_update_order_status(uuid,text,text,text) from public,anon;
grant execute on function public.driver_claim_order(uuid) to authenticated;
grant execute on function public.merchant_update_order_status(uuid,text,text) to authenticated;
grant execute on function public.driver_update_order_status(uuid,text,text,text) to authenticated;
