-- SUGOMATE customer addresses and transactional order placement.
-- Depends on 20261103070000_customer_marketplace_catalog.sql.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references auth.users(id),
  merchant_id uuid not null references public.merchants(id),
  branch_id uuid not null references public.merchant_branches(id),
  delivery_address_id uuid not null references public.customer_addresses(id),
  address_snapshot jsonb not null,
  status text not null default 'pending_merchant' check (status in ('pending_merchant','accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit','delivered','cancelled','rejected')),
  payment_method text not null check (payment_method in ('cod','gcash')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  total numeric(12,2) not null check (total = subtotal + delivery_fee),
  customer_note text,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total numeric(12,2) not null check (line_total = unit_price * quantity),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists orders_customer_idx on public.orders(customer_id, placed_at desc);
create index if not exists orders_merchant_idx on public.orders(merchant_id, status, placed_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_history_order_idx on public.order_status_history(order_id, created_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

grant select on public.orders, public.order_items, public.order_status_history to authenticated;

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders
 for select to authenticated using (customer_id = (select auth.uid()));

drop policy if exists "Merchant members read their orders" on public.orders;
create policy "Merchant members read their orders" on public.orders
 for select to authenticated using (
  exists (select 1 from public.merchant_members mm where mm.merchant_id = orders.merchant_id and mm.user_id = (select auth.uid()))
 );

drop policy if exists "Admins read all orders" on public.orders;
create policy "Admins read all orders" on public.orders
 for select to authenticated using ((select app_private.has_role((select auth.uid()), 'admin'::public.app_role)));

drop policy if exists "Order items visible to order participants" on public.order_items;
create policy "Order items visible to order participants" on public.order_items
 for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and (
    o.customer_id = (select auth.uid())
    or exists (select 1 from public.merchant_members mm where mm.merchant_id = o.merchant_id and mm.user_id = (select auth.uid()))
    or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
  ))
 );

drop policy if exists "Order history visible to order participants" on public.order_status_history;
create policy "Order history visible to order participants" on public.order_status_history
 for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_status_history.order_id and (
    o.customer_id = (select auth.uid())
    or exists (select 1 from public.merchant_members mm where mm.merchant_id = o.merchant_id and mm.user_id = (select auth.uid()))
    or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
  ))
 );

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
  if v_customer is null then raise exception 'You must be signed in to place an order.'; end if;
  if p_payment_method not in ('cod','gcash') then raise exception 'Unsupported payment method.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Your basket is empty or contains too many different products.';
  end if;

  select * into v_address from public.customer_addresses
    where id = p_address_id and customer_id = v_customer;
  if not found then raise exception 'Choose one of your saved delivery addresses.'; end if;

  if not exists (
    select 1 from public.municipalities m where m.id = v_address.municipality_id and m.is_serviceable = true
  ) then raise exception 'This delivery area is not currently serviceable.'; end if;

  select z.base_delivery_fee into v_delivery_fee
    from public.service_zones z
    where z.municipality_id = v_address.municipality_id and z.is_active = true
    order by z.created_at asc, z.id asc limit 1;
  if v_delivery_fee is null then raise exception 'Delivery fee is not configured for this area yet. Please try again later.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Invalid product quantity.'; end if;

    select p.* into v_product from public.products p
      join public.merchants m on m.id = p.merchant_id
      join public.merchant_branches b on b.id = p.branch_id
      where p.id = v_product_id and p.is_available = true
        and (p.stock_quantity is null or p.stock_quantity >= v_qty)
        and m.status = 'approved' and b.is_active = true
      for share of p;
    if not found then raise exception 'One of the products is no longer available. Refresh your basket.'; end if;

    if v_merchant is null then
      v_merchant := v_product.merchant_id;
      v_branch := v_product.branch_id;
    elsif v_merchant <> v_product.merchant_id or v_branch <> v_product.branch_id then
      raise exception 'Please place separate orders for products from different stores or branches.';
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'Your basket is empty.'; end if;

  v_order_number := 'SG-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders (
    order_number, customer_id, merchant_id, branch_id, delivery_address_id,
    address_snapshot, payment_method, payment_status, subtotal, delivery_fee, total, customer_note
  ) values (
    v_order_number, v_customer, v_merchant, v_branch, v_address.id,
    jsonb_build_object(
      'label',v_address.label,'recipient_name',v_address.recipient_name,
      'recipient_phone',v_address.recipient_phone,'address_line',v_address.address_line,
      'landmark',v_address.landmark,'municipality_id',v_address.municipality_id,
      'barangay_id',v_address.barangay_id
    ),
    p_payment_method, case when p_payment_method = 'gcash' then 'pending' else 'unpaid' end,
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee, nullif(left(coalesce(p_customer_note,''),500),'')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = v_product_id;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
      values (v_order_id,v_product.id,v_product.name,v_product.price,v_qty,v_product.price*v_qty);
  end loop;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values (v_order_id,null,'pending_merchant',v_customer,'Order placed by customer');
  return v_order_id;
end;
$$;

revoke all on function public.place_customer_order(uuid,jsonb,text,text) from public, anon;
grant execute on function public.place_customer_order(uuid,jsonb,text,text) to authenticated;
