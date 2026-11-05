-- SUGOMATE order workflow: reserve inventory on merchant acceptance and require a rider commitment before preparation.
-- Stock quantity remains physical on-hand inventory. Reservations reduce sellable stock until pickup or release.

alter table public.orders
  add column if not exists rider_claim_deadline_at timestamptz,
  add column if not exists rider_assignment_expired_at timestamptz,
  add column if not exists rider_on_way_at timestamptz,
  add column if not exists stock_reserved_at timestamptz,
  add column if not exists stock_committed_at timestamptz,
  add column if not exists stock_released_at timestamptz;

create table if not exists public.order_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved','consumed','released')),
  reserved_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(order_id, product_id)
);
create index if not exists order_stock_reservations_product_active_idx
  on public.order_stock_reservations(product_id) where status='reserved';
create index if not exists orders_rider_claim_deadline_idx
  on public.orders(rider_claim_deadline_at) where status='accepted' and driver_user_id is null;

alter table public.order_stock_reservations enable row level security;
revoke all on public.order_stock_reservations from anon, authenticated;

-- Checkout validates current sellable inventory but does not decrement physical stock.
create or replace function public.place_customer_order(
  p_address_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_address public.customer_addresses%rowtype;
  v_product public.products%rowtype;
  v_merchant uuid;
  v_branch uuid;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2);
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_reserved integer;
  v_count integer := 0;
begin
  if v_customer is null then raise exception 'You must be signed in to place an order.'; end if;
  if not exists (select 1 from public.user_roles ur where ur.user_id=v_customer and ur.role='customer'::public.app_role) then
    raise exception 'Only customer accounts can place orders.';
  end if;
  if p_payment_method is null or p_payment_method not in ('cod','gcash') then raise exception 'Unsupported payment method.'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30 then
    raise exception 'Your basket is empty or contains too many different products.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) e(value) group by e.value->>'product_id' having count(*)>1) then
    raise exception 'Your basket contains duplicate product entries. Refresh and try again.';
  end if;
  select * into v_address from public.customer_addresses where id=p_address_id and customer_id=v_customer;
  if not found then raise exception 'Choose one of your saved delivery addresses.'; end if;
  if not exists(select 1 from public.municipalities m where m.id=v_address.municipality_id and m.is_serviceable=true) then
    raise exception 'This delivery area is not currently serviceable.';
  end if;
  select z.base_delivery_fee into v_delivery_fee from public.service_zones z
  where z.municipality_id=v_address.municipality_id and z.is_active=true order by z.created_at asc,z.id asc limit 1;
  if v_delivery_fee is null then raise exception 'Delivery fee is not configured for this area yet. Please try again later.'; end if;

  for v_item in select e.value from jsonb_array_elements(p_items) e(value) order by e.value->>'product_id' loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f-]{36}$' or coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid product or quantity in your basket.';
    end if;
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty<1 or v_qty>99 then raise exception 'Invalid product quantity.'; end if;

    select p.* into v_product from public.products p
    join public.merchants m on m.id=p.merchant_id
    join public.merchant_branches b on b.id=p.branch_id
    where p.id=v_product_id and p.is_available=true and m.status='approved' and b.is_active=true
    for update of p;
    if not found then raise exception 'One of the products is no longer available. Refresh your basket.'; end if;

    select coalesce(sum(r.quantity),0)::integer into v_reserved
    from public.order_stock_reservations r where r.product_id=v_product_id and r.status='reserved';
    if v_product.stock_quantity is not null and v_product.stock_quantity-v_reserved<v_qty then
      raise exception 'One of the products has insufficient available stock after existing reservations. Refresh your basket.';
    end if;
    if v_merchant is null then v_merchant:=v_product.merchant_id; v_branch:=v_product.branch_id;
    elsif v_merchant<>v_product.merchant_id or v_branch<>v_product.branch_id then
      raise exception 'Please place separate orders for products from different stores or branches.';
    end if;
    v_subtotal:=v_subtotal+(v_product.price*v_qty);
    v_count:=v_count+1;
  end loop;
  if v_count=0 then raise exception 'Your basket is empty.'; end if;

  v_order_number:='SG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders(order_number,customer_id,merchant_id,branch_id,delivery_address_id,address_snapshot,
    payment_method,payment_status,subtotal,delivery_fee,total,customer_note)
  values(v_order_number,v_customer,v_merchant,v_branch,v_address.id,
    jsonb_build_object('label',v_address.label,'recipient_name',v_address.recipient_name,'recipient_phone',v_address.recipient_phone,
      'address_line',v_address.address_line,'landmark',v_address.landmark,'municipality_id',v_address.municipality_id,'barangay_id',v_address.barangay_id),
    p_payment_method,case when p_payment_method='gcash' then 'pending' else 'unpaid' end,
    v_subtotal,v_delivery_fee,v_subtotal+v_delivery_fee,nullif(left(coalesce(p_customer_note,''),500),''))
  returning id into v_order_id;

  for v_item in select e.value from jsonb_array_elements(p_items) e(value) order by e.value->>'product_id' loop
    v_product_id:=(v_item->>'product_id')::uuid;
    v_qty:=(v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_product_id;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
    values(v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_product.price*v_qty);
  end loop;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(v_order_id,null,'pending_merchant',v_customer,'Order placed; inventory will be reserved when the merchant accepts');
  return v_order_id;
end;
$$;
revoke all on function public.place_customer_order(uuid,jsonb,text,text) from public,anon;
grant execute on function public.place_customer_order(uuid,jsonb,text,text) to authenticated;

-- Merchant acceptance atomically reserves all finite and unlimited product quantities.
-- Preparation is blocked until the assigned rider explicitly confirms "On my way".
create or replace function public.merchant_update_order_status(
  p_order_id uuid,p_next_status text,p_note text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_reserved integer;
begin
  if v_actor is null then raise exception 'You must be signed in.'; end if;
  select o.* into v_order from public.orders o
  where o.id=p_order_id
    and exists(select 1 from public.merchant_members mm where mm.merchant_id=o.merchant_id and mm.user_id=v_actor)
    and exists(select 1 from public.merchants m where m.id=o.merchant_id and m.status='approved')
  for update;
  if not found then raise exception 'Order not found or you do not have permission to manage it.'; end if;

  if v_order.status='pending_merchant' and p_next_status='rejected' then
    update public.orders set status='rejected',updated_at=now() where id=p_order_id;
  elsif v_order.status='pending_merchant' and p_next_status='accepted' then
    for v_item in select oi.product_id,oi.quantity from public.order_items oi where oi.order_id=p_order_id order by oi.product_id loop
      if v_item.product_id is null then raise exception 'An order item is missing its product link. Contact support.'; end if;
      select * into v_product from public.products p
      where p.id=v_item.product_id and p.merchant_id=v_order.merchant_id and p.branch_id=v_order.branch_id
      for update;
      if not found or not v_product.is_available then raise exception 'A requested item is no longer available. Reject the order or update the catalog.'; end if;
      select coalesce(sum(r.quantity),0)::integer into v_reserved from public.order_stock_reservations r
      where r.product_id=v_item.product_id and r.status='reserved';
      if v_product.stock_quantity is not null and v_product.stock_quantity-v_reserved<v_item.quantity then
        raise exception 'Insufficient stock for %. Available after reservations: %.',v_product.name,greatest(v_product.stock_quantity-v_reserved,0);
      end if;
      insert into public.order_stock_reservations(order_id,product_id,quantity,status)
      values(p_order_id,v_item.product_id,v_item.quantity,'reserved')
      on conflict(order_id,product_id) do update set quantity=excluded.quantity,status='reserved',reserved_at=now(),resolved_at=null;
    end loop;
    update public.orders set status='accepted',stock_reserved_at=now(),stock_released_at=null,
      rider_claim_deadline_at=now()+interval '5 minutes',rider_assignment_expired_at=null,updated_at=now()
    where id=p_order_id;
  elsif v_order.status='accepted' and p_next_status='preparing' then
    if v_order.driver_user_id is null or v_order.driver_assignment_status<>'en_route' or v_order.rider_on_way_at is null then
      raise exception 'Wait until the assigned rider confirms they are on the way to your store before preparing this order.';
    end if;
    update public.orders set status='preparing',updated_at=now() where id=p_order_id;
  elsif v_order.status='preparing' and p_next_status='ready_for_pickup' then
    update public.orders set status='ready_for_pickup',updated_at=now() where id=p_order_id;
  elsif v_order.status in ('accepted','preparing') and p_next_status='cancelled' then
    if v_order.picked_up_at is not null then raise exception 'An order already picked up cannot be cancelled here.'; end if;
    update public.order_stock_reservations set status='released',resolved_at=now()
    where order_id=p_order_id and status='reserved';
    update public.orders set status='cancelled',stock_released_at=now(),driver_user_id=null,
      driver_assignment_status=null,updated_at=now() where id=p_order_id;
  else
    raise exception 'This order cannot be moved to the requested status.';
  end if;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,p_next_status,v_actor,nullif(left(coalesce(p_note,''),300),''));
end;
$$;
revoke all on function public.merchant_update_order_status(uuid,text,text) from public,anon;
grant execute on function public.merchant_update_order_status(uuid,text,text) to authenticated;

-- A driver claim is exclusive, but a claim alone is not a preparation commitment.
create or replace function public.driver_claim_order(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  perform 1 from public.driver_profiles dp where dp.user_id=v_actor and dp.status='active' and dp.is_available=true for update;
  if not found then raise exception 'You must be online as an approved driver to claim an order.'; end if;
  if exists(select 1 from public.orders o where o.driver_user_id=v_actor and o.status in ('accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit')) then
    raise exception 'Finish your current delivery before claiming another order.';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status not in ('accepted','ready_for_pickup') or v_order.driver_user_id is not null then
    raise exception 'This order is no longer available. Refresh the order list.';
  end if;
  if v_order.status='accepted' and v_order.rider_claim_deadline_at is not null and v_order.rider_assignment_expired_at is not null then
    -- Late claims remain possible after the warning; merchant sees that the target was missed.
    null;
  end if;
  update public.orders set driver_user_id=v_actor,driver_assignment_status='claimed',assigned_at=now(),rider_on_way_at=null,updated_at=now()
  where id=p_order_id;
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'driver_claimed_order','orders',p_order_id::text,
    jsonb_build_object('order_number',v_order.order_number,'commitment_required',true));
end;
$$;

create or replace function public.driver_confirm_on_the_way(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists(select 1 from public.driver_profiles dp where dp.user_id=v_actor and dp.status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders where id=p_order_id and driver_user_id=v_actor for update;
  if not found or v_order.status<>'accepted' or v_order.driver_assignment_status<>'claimed' then
    raise exception 'This order is not awaiting your rider commitment.';
  end if;
  update public.orders set driver_assignment_status='en_route',rider_on_way_at=now(),updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,'accepted','accepted',v_actor,'Rider confirmed they are on the way to the merchant');
end;
$$;

create or replace function public.driver_release_order_claim(p_order_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  select * into v_order from public.orders where id=p_order_id and driver_user_id=v_actor for update;
  if not found or v_order.status<>'accepted' or v_order.driver_assignment_status<>'claimed' or v_order.rider_on_way_at is not null then
    raise exception 'You can only release an order before confirming you are on the way.';
  end if;
  update public.orders set driver_user_id=null,driver_assignment_status=null,assigned_at=null,updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,'accepted','accepted',v_actor,'Rider released the claim before committing to pickup');
end;
$$;

-- On pickup, convert reservations into actual stock deductions exactly once.
create or replace function public.driver_update_order_status(
  p_order_id uuid,p_next_status text,p_proof_path text default null,p_note text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid(); v_order public.orders%rowtype; v_valid boolean:=false; v_res record;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists(select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders where id=p_order_id and driver_user_id=v_actor for update;
  if not found then raise exception 'Assigned order not found.'; end if;

  v_valid:=(v_order.status='ready_for_pickup' and v_order.driver_assignment_status='en_route' and p_next_status='picked_up')
    or (v_order.status='ready_for_pickup' and v_order.driver_assignment_status='accepted' and p_next_status='picked_up')
    or (v_order.status='assigned' and v_order.driver_assignment_status='accepted' and p_next_status='picked_up')
    or (v_order.status='picked_up' and p_next_status='in_transit')
    or (v_order.status='in_transit' and p_next_status='delivered');
  if not v_valid then raise exception 'Wait for the merchant to mark the order ready, or check the current delivery status.'; end if;

  if p_next_status='delivered' then
    if p_proof_path is null or p_proof_path not like v_actor::text||'/'||p_order_id::text||'/%'
      or not exists(select 1 from storage.objects so where so.bucket_id='delivery-proofs' and so.name=p_proof_path) then
      raise exception 'Upload a valid delivery photo before completing the order.';
    end if;
  end if;

  if p_next_status='picked_up' then
    for v_res in select r.id,r.product_id,r.quantity from public.order_stock_reservations r
      where r.order_id=p_order_id and r.status='reserved' order by r.product_id for update loop
      update public.products set stock_quantity=stock_quantity-v_res.quantity,updated_at=now()
      where id=v_res.product_id and stock_quantity is not null and stock_quantity>=v_res.quantity;
      if not found then raise exception 'Reserved stock could not be committed. Contact support before pickup.'; end if;
      update public.order_stock_reservations set status='consumed',resolved_at=now() where id=v_res.id;
    end loop;
  end if;

  update public.orders set status=p_next_status,
    picked_up_at=case when p_next_status='picked_up' then now() else picked_up_at end,
    stock_committed_at=case when p_next_status='picked_up' then now() else stock_committed_at end,
    delivered_at=case when p_next_status='delivered' then now() else delivered_at end,
    delivery_proof_path=case when p_next_status='delivered' then p_proof_path else delivery_proof_path end,
    driver_note=coalesce(nullif(left(coalesce(p_note,''),500),''),driver_note),updated_at=now()
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,p_next_status,v_actor,
    coalesce(nullif(left(coalesce(p_note,''),500),''),case when p_next_status='delivered' then 'Delivery completed with photo proof' else 'Delivery status updated by partner' end));
end;
$$;

-- Mark the five-minute rider-assignment target as missed; orders remain claimable so they are not stranded.
create or replace function public.expire_unassigned_order_rider_targets()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  update public.orders set rider_assignment_expired_at=now(),updated_at=now()
  where status='accepted' and driver_user_id is null and rider_claim_deadline_at is not null
    and rider_claim_deadline_at<=now() and rider_assignment_expired_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.driver_claim_order(uuid) from public,anon;
revoke all on function public.driver_confirm_on_the_way(uuid) from public,anon;
revoke all on function public.driver_release_order_claim(uuid) from public,anon;
revoke all on function public.driver_update_order_status(uuid,text,text,text) from public,anon;
revoke all on function public.expire_unassigned_order_rider_targets() from public,anon;
grant execute on function public.driver_claim_order(uuid) to authenticated;
grant execute on function public.driver_confirm_on_the_way(uuid) to authenticated;
grant execute on function public.driver_release_order_claim(uuid) to authenticated;
grant execute on function public.driver_update_order_status(uuid,text,text,text) to authenticated;
grant execute on function public.expire_unassigned_order_rider_targets() to authenticated;
