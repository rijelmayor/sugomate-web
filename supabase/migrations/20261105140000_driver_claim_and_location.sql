-- Rider self-selection + location ping.
-- Drivers can see unassigned ready-for-pickup orders and claim one.
-- Last known location is stored so we can sort nearest and later auto-offer.

alter table public.driver_profiles
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz;

-- Drivers may read unassigned orders that are ready for pickup (limited fields).
drop policy if exists "Active drivers read ready pickup orders" on public.orders;
create policy "Active drivers read ready pickup orders" on public.orders
  for select to authenticated
  using (
    status = 'ready_for_pickup'
    and driver_user_id is null
    and exists (
      select 1 from public.driver_profiles dp
      where dp.user_id = (select auth.uid())
        and dp.status = 'active'
        and dp.is_available = true
    )
  );

-- Store a fresh location ping from the driver's browser.
create or replace function public.driver_ping_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid location.';
  end if;
  update public.driver_profiles
  set last_lat = p_lat,
      last_lng = p_lng,
      last_location_at = now(),
      last_seen_at = now(),
      updated_at = now()
  where user_id = v_actor and status = 'active';
  if not found then raise exception 'Active driver profile required.'; end if;
end;
$$;

-- Available driver claims an unassigned ready-for-pickup order.
-- Assignment is accepted immediately (no offer/decline round).
create or replace function public.driver_claim_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists (
    select 1 from public.driver_profiles dp
    where dp.user_id = v_actor and dp.status = 'active' and dp.is_available = true
  ) then
    raise exception 'You must be online to claim an order.';
  end if;

  -- One active delivery at a time
  if exists (
    select 1 from public.orders o
    where o.driver_user_id = v_actor
      and o.status in ('assigned', 'picked_up', 'in_transit')
  ) then
    raise exception 'Finish your current delivery before claiming another order.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'ready_for_pickup' or v_order.driver_user_id is not null then
    raise exception 'This order is no longer available.';
  end if;

  update public.orders
  set driver_user_id = v_actor,
      driver_assignment_status = 'accepted',
      status = 'assigned',
      assigned_at = now(),
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history(order_id, from_status, to_status, actor_id, note)
  values (p_order_id, v_order.status, 'assigned', v_actor, 'Delivery partner claimed the order');
end;
$$;

revoke all on function public.driver_ping_location(double precision, double precision) from public, anon;
revoke all on function public.driver_claim_order(uuid) from public, anon;
grant execute on function public.driver_ping_location(double precision, double precision) to authenticated;
grant execute on function public.driver_claim_order(uuid) to authenticated;
