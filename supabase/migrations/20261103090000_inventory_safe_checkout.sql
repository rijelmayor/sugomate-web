-- Serialize inventory checks and decrement finite stock during checkout.
-- Apply after 20261103080000_customer_order_engine.sql.

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
  v_count integer := 0;
begin
  if v_customer is null then
    raise exception 'You must be signed in to place an order.';
  end if;
  if p_payment_method is null or p_payment_method not in ('cod','gcash') then
    raise exception 'Unsupported payment method.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your basket is empty or contains too many different products.';
  end if;

  -- Reject duplicate product IDs so each stock row is accounted for exactly once.
  if exists (
    select 1
    from jsonb_array_elements(p_items) e(value)
    group by e.value->>'product_id'
    having count(*) > 1
  ) then
    raise exception 'Your basket contains duplicate product entries. Refresh and try again.';
  end if;

  select * into v_address
  from public.customer_addresses
  where id = p_address_id and customer_id = v_customer;
  if not found then
    raise exception 'Choose one of your saved delivery addresses.';
  end if;

  if not exists (
    select 1 from public.municipalities m
    where m.id = v_address.municipality_id and m.is_serviceable = true
  ) then
    raise exception 'This delivery area is not currently serviceable.';
  end if;

  select z.base_delivery_fee into v_delivery_fee
  from public.service_zones z
  where z.municipality_id = v_address.municipality_id and z.is_active = true
  order by z.created_at asc, z.id asc
  limit 1;
  if v_delivery_fee is null then
    raise exception 'Delivery fee is not configured for this area yet. Please try again later.';
  end if;

  -- Lock product rows in a deterministic order. Concurrent checkouts for the same
  -- inventory wait for one another, then re-check the latest committed stock.
  for v_item in
    select e.value
    from jsonb_array_elements(p_items) e(value)
    order by e.value->>'product_id'
  loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f-]{36}$'
       or coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid product or quantity in your basket.';
    end if;

    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid product quantity.';
    end if;

    select p.* into v_product
    from public.products p
    join public.merchants m on m.id = p.merchant_id
    join public.merchant_branches b on b.id = p.branch_id
    where p.id = v_product_id
      and p.is_available = true
      and (p.stock_quantity is null or p.stock_quantity >= v_qty)
      and m.status = 'approved'
      and b.is_active = true
    for update of p;

    if not found then
      raise exception 'One of the products is no longer available or has insufficient stock. Refresh your basket.';
    end if;

    if v_merchant is null then
      v_merchant := v_product.merchant_id;
      v_branch := v_product.branch_id;
    elsif v_merchant <> v_product.merchant_id or v_branch <> v_product.branch_id then
      raise exception 'Please place separate orders for products from different stores or branches.';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Your basket is empty.';
  end if;

  v_order_number := 'SG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders (
    order_number, customer_id, merchant_id, branch_id, delivery_address_id,
    address_snapshot, payment_method, payment_status, subtotal,
    delivery_fee, total, customer_note
  ) values (
    v_order_number, v_customer, v_merchant, v_branch, v_address.id,
    jsonb_build_object(
      'label',v_address.label,
      'recipient_name',v_address.recipient_name,
      'recipient_phone',v_address.recipient_phone,
      'address_line',v_address.address_line,
      'landmark',v_address.landmark,
      'municipality_id',v_address.municipality_id,
      'barangay_id',v_address.barangay_id
    ),
    p_payment_method,
    case when p_payment_method = 'gcash' then 'pending' else 'unpaid' end,
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    nullif(left(coalesce(p_customer_note,''),500),'')
  ) returning id into v_order_id;

  -- Decrement finite stock while the row locks from the validation pass are held.
  for v_item in
    select e.value
    from jsonb_array_elements(p_items) e(value)
    order by e.value->>'product_id'
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    select * into v_product
    from public.products
    where id = v_product_id;

    update public.products
    set stock_quantity = stock_quantity - v_qty,
        updated_at = now()
    where id = v_product_id
      and stock_quantity is not null;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.price,
      v_qty, v_product.price * v_qty
    );
  end loop;

  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, note
  ) values (
    v_order_id, null, 'pending_merchant', v_customer, 'Order placed by customer'
  );

  return v_order_id;
end;
$$;

revoke all on function public.place_customer_order(uuid,jsonb,text,text) from public, anon;
grant execute on function public.place_customer_order(uuid,jsonb,text,text) to authenticated;


-- Merchant order status changes are performed through a narrowly-scoped RPC.
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
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
    and exists (
      select 1
      from public.merchant_members mm
      where mm.merchant_id = o.merchant_id
        and mm.user_id = v_actor
    )
    and exists (
      select 1 from public.merchants m
      where m.id = o.merchant_id and m.status = 'approved'
    )
  for update;

  if not found then
    raise exception 'Order not found or you do not have permission to manage it.';
  end if;

  v_allowed :=
    (v_order.status = 'pending_merchant' and p_next_status in ('accepted','rejected'))
    or (v_order.status = 'accepted' and p_next_status = 'preparing')
    or (v_order.status = 'preparing' and p_next_status = 'ready_for_pickup');

  if not v_allowed then
    raise exception 'This order cannot be moved to the requested status.';
  end if;

  update public.orders
  set status = p_next_status,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (
    order_id, from_status, to_status, actor_id, note
  ) values (
    p_order_id, v_order.status, p_next_status, v_actor,
    nullif(left(coalesce(p_note,''),300),'')
  );
end;
$$;

revoke all on function public.merchant_update_order_status(uuid,text,text) from public, anon;
grant execute on function public.merchant_update_order_status(uuid,text,text) to authenticated;
