-- SUGOMATE financial integration: checkout price snapshots, delivered-order ledgers and payout safeguards.
-- Depends on 20261106002933_financial_management_foundation.sql.
-- This migration is additive and preserves the existing order, stock reservation and rider commitment rules.

alter table public.orders
  add column if not exists merchant_srp_subtotal numeric(12,2) not null default 0,
  add column if not exists merchant_system_usage_total numeric(12,2) not null default 0,
  add column if not exists delivery_base_rate numeric(12,2) not null default 0,
  add column if not exists delivery_usage_method text not null default 'percentage'
    check (delivery_usage_method in ('percentage','fixed')),
  add column if not exists delivery_usage_rate numeric(12,2) not null default 0,
  add column if not exists delivery_system_usage_amount numeric(12,2) not null default 0,
  add column if not exists financial_snapshot_at timestamptz;

alter table public.order_items
  add column if not exists merchant_srp_unit_price numeric(12,2) not null default 0,
  add column if not exists merchant_usage_unit_amount numeric(12,2) not null default 0,
  add column if not exists merchant_usage_method text not null default 'percentage'
    check (merchant_usage_method in ('percentage','fixed')),
  add column if not exists merchant_usage_rate numeric(12,2) not null default 0;

alter table public.orders
  add constraint orders_financial_snapshot_nonnegative
  check (merchant_srp_subtotal >= 0 and merchant_system_usage_total >= 0
    and delivery_base_rate >= 0 and delivery_usage_rate >= 0
    and delivery_system_usage_amount >= 0
    and delivery_system_usage_amount <= delivery_base_rate);

-- Checkout recalculates all prices from the trusted catalogue and the active Admin settings.
-- Customer item price = merchant SRP + merchant System Usage.
-- Customer delivery fee remains the configured service-zone base fee without a platform markup.
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
  v_settings public.platform_financial_settings%rowtype;
  v_merchant uuid;
  v_branch uuid;
  v_subtotal numeric(12,2) := 0;
  v_merchant_srp_subtotal numeric(12,2) := 0;
  v_merchant_usage_total numeric(12,2) := 0;
  v_item_usage numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_delivery_usage numeric(12,2) := 0;
  v_delivery_method text := 'percentage';
  v_delivery_rate numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_reserved integer;
  v_count integer := 0;
begin
  if v_customer is null then raise exception 'You must be signed in to place an order.'; end if;
  if not exists(select 1 from public.user_roles ur where ur.user_id=v_customer and ur.role='customer'::public.app_role) then
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
    where z.municipality_id=v_address.municipality_id and z.is_active=true
    order by z.created_at asc,z.id asc limit 1;
  if v_delivery_fee is null then raise exception 'Delivery fee is not configured for this area yet. Please try again later.'; end if;

  select * into v_settings from public.platform_financial_settings where id=1;
  if not found then
    v_settings.merchant_usage_enabled:=false;
    v_settings.merchant_usage_method:='percentage';
    v_settings.merchant_usage_value:=0;
    v_settings.delivery_usage_enabled:=false;
    v_settings.delivery_usage_method:='percentage';
    v_settings.delivery_usage_value:=0;
  end if;

  if v_settings.delivery_usage_enabled then
    v_delivery_method:=v_settings.delivery_usage_method;
    v_delivery_rate:=v_settings.delivery_usage_value;
    if v_delivery_method='percentage' then
      if v_delivery_rate>100 then raise exception 'Delivery System Usage cannot exceed 100 percent.'; end if;
      v_delivery_usage:=round(v_delivery_fee*v_delivery_rate/100,2);
    else
      v_delivery_usage:=v_delivery_rate;
    end if;
    if v_delivery_usage>v_delivery_fee then
      raise exception 'Configured Delivery System Usage exceeds this delivery base rate. Admin must adjust the rate before checkout.';
    end if;
  end if;

  for v_item in select e.value from jsonb_array_elements(p_items) e(value) order by e.value->>'product_id' loop
    if coalesce(v_item->>'product_id','') !~* '^[0-9a-f-]{36}$' or coalesce(v_item->>'quantity','') !~ '^[0-9]+$' then
      raise exception 'Invalid product or quantity in your basket.';
    end if;
    v_product_id:=(v_item->>'product_id')::uuid;
    v_qty:=(v_item->>'quantity')::integer;
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

    v_item_usage:=0;
    if v_settings.merchant_usage_enabled then
      if v_settings.merchant_usage_method='percentage' then
        v_item_usage:=round(v_product.price*v_settings.merchant_usage_value/100,2);
      else
        v_item_usage:=v_settings.merchant_usage_value;
      end if;
    end if;
    v_merchant_srp_subtotal:=v_merchant_srp_subtotal+(v_product.price*v_qty);
    v_merchant_usage_total:=v_merchant_usage_total+(v_item_usage*v_qty);
    v_subtotal:=v_subtotal+((v_product.price+v_item_usage)*v_qty);
    v_count:=v_count+1;
  end loop;
  if v_count=0 then raise exception 'Your basket is empty.'; end if;

  v_order_number:='SG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.orders(
    order_number,customer_id,merchant_id,branch_id,delivery_address_id,address_snapshot,
    payment_method,payment_status,subtotal,delivery_fee,total,customer_note,
    merchant_srp_subtotal,merchant_system_usage_total,delivery_base_rate,
    delivery_usage_method,delivery_usage_rate,delivery_system_usage_amount,financial_snapshot_at
  ) values(
    v_order_number,v_customer,v_merchant,v_branch,v_address.id,
    jsonb_build_object('label',v_address.label,'recipient_name',v_address.recipient_name,
      'recipient_phone',v_address.recipient_phone,'address_line',v_address.address_line,
      'landmark',v_address.landmark,'municipality_id',v_address.municipality_id,'barangay_id',v_address.barangay_id),
    p_payment_method,case when p_payment_method='gcash' then 'pending' else 'unpaid' end,
    v_subtotal,v_delivery_fee,v_subtotal+v_delivery_fee,nullif(left(coalesce(p_customer_note,''),500),''),
    v_merchant_srp_subtotal,v_merchant_usage_total,v_delivery_fee,
    v_delivery_method,v_delivery_rate,v_delivery_usage,now()
  ) returning id into v_order_id;

  for v_item in select e.value from jsonb_array_elements(p_items) e(value) order by e.value->>'product_id' loop
    v_product_id:=(v_item->>'product_id')::uuid;
    v_qty:=(v_item->>'quantity')::integer;
    select * into v_product from public.products where id=v_product_id;
    v_item_usage:=0;
    if v_settings.merchant_usage_enabled then
      if v_settings.merchant_usage_method='percentage' then
        v_item_usage:=round(v_product.price*v_settings.merchant_usage_value/100,2);
      else
        v_item_usage:=v_settings.merchant_usage_value;
      end if;
    end if;
    insert into public.order_items(
      order_id,product_id,product_name,unit_price,quantity,line_total,
      merchant_srp_unit_price,merchant_usage_unit_amount,merchant_usage_method,merchant_usage_rate
    ) values(
      v_order_id,v_product.id,v_product.name,v_product.price+v_item_usage,v_qty,
      (v_product.price+v_item_usage)*v_qty,v_product.price,v_item_usage,
      case when v_settings.merchant_usage_enabled then v_settings.merchant_usage_method else 'percentage' end,
      case when v_settings.merchant_usage_enabled then v_settings.merchant_usage_value else 0 end
    );
  end loop;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(v_order_id,null,'pending_merchant',v_customer,'Order placed; inventory will be reserved when the merchant accepts');
  return v_order_id;
end;
$$;

revoke all on function public.place_customer_order(uuid,jsonb,text,text) from public,anon;
grant execute on function public.place_customer_order(uuid,jsonb,text,text) to authenticated;

-- Record the merchant platform fee and driver net earnings only when photo-verified delivery completes.
-- The existing delivery proof, status, stock-consumption and history checks remain intact.
create or replace function public.driver_update_order_status(
  p_order_id uuid,p_next_status text,p_proof_path text default null,p_note text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_valid boolean:=false;
  v_res record;
  v_stock integer;
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
      select stock_quantity into v_stock from public.products where id=v_res.product_id for update;
      if not found then raise exception 'Reserved product no longer exists. Contact support before pickup.'; end if;
      if v_stock is not null then
        if v_stock<v_res.quantity then raise exception 'Reserved stock could not be committed. Contact support before pickup.'; end if;
        update public.products set stock_quantity=stock_quantity-v_res.quantity,updated_at=now() where id=v_res.product_id;
      end if;
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

  if p_next_status='delivered' then
    insert into public.merchant_system_usage_entries(
      order_id,merchant_id,order_date,merchant_srp_subtotal,usage_method,usage_rate,system_usage_amount,status
    ) values(
      v_order.id,v_order.merchant_id,(now() at time zone 'Asia/Manila')::date,
      v_order.merchant_srp_subtotal,
      coalesce((select oi.merchant_usage_method from public.order_items oi where oi.order_id=v_order.id limit 1),'percentage'),
      coalesce((select oi.merchant_usage_rate from public.order_items oi where oi.order_id=v_order.id limit 1),0),
      v_order.merchant_system_usage_total,'unbilled'
    ) on conflict(order_id) do nothing;

    insert into public.driver_earnings_entries(
      order_id,driver_user_id,driver_base_rate,usage_method,usage_rate,
      delivery_system_usage,net_delivery_earnings,status
    ) values(
      v_order.id,v_actor,v_order.delivery_base_rate,v_order.delivery_usage_method,
      v_order.delivery_usage_rate,v_order.delivery_system_usage_amount,
      v_order.delivery_base_rate-v_order.delivery_system_usage_amount,'earned'
    ) on conflict(order_id) do nothing;
  end if;
end;
$$;

revoke all on function public.driver_update_order_status(uuid,text,text,text) from public,anon;
grant execute on function public.driver_update_order_status(uuid,text,text,text) to authenticated;

-- Authoritative full-history balance for the signed-in active driver.
create or replace function public.driver_available_balance()
returns numeric(12,2)
language plpgsql security invoker set search_path=''
as $balance$
declare
  v_actor uuid:=auth.uid();
  v_balance numeric(12,2);
  v_reserved numeric(12,2);
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists(select 1 from public.driver_profiles dp where dp.user_id=v_actor and dp.status='active') then
    raise exception 'Only active delivery partners can view a payout balance.';
  end if;
  select coalesce(sum(e.net_delivery_earnings),0) into v_balance
    from public.driver_earnings_entries e where e.driver_user_id=v_actor and e.status in ('earned','adjusted');
  select v_balance+coalesce(sum(b.amount),0) into v_balance
    from public.driver_benefit_entries b where b.driver_user_id=v_actor and b.status in ('approved','paid');
  select coalesce(sum(r.requested_amount),0) into v_reserved
    from public.driver_payout_requests r where r.driver_user_id=v_actor and r.status in ('pending','approved','paid');
  return greatest(v_balance-v_reserved,0);
end;
$balance$;
revoke all on function public.driver_available_balance() from public,anon;
grant execute on function public.driver_available_balance() to authenticated;

-- Driver balance is computed from delivered earnings and approved benefits, less all outstanding/paid payouts.
-- Lock the driver's profile to serialize concurrent requests and prevent over-withdrawal.
create or replace function public.driver_request_payout(
  p_amount numeric,
  p_payout_method text default null,
  p_account_snapshot jsonb default null,
  p_driver_note text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_balance numeric(12,2);
  v_request_id uuid;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Enter a valid payout amount.'; end if;
  perform 1 from public.driver_profiles dp where dp.user_id=v_actor and dp.status='active' for update;
  if not found then raise exception 'Only active delivery partners can request payouts.'; end if;

  v_balance:=public.driver_available_balance();
  if p_amount>v_balance then
    raise exception 'Requested payout exceeds your available balance of ₱%.',to_char(v_balance,'FM999,999,990.00');
  end if;

  insert into public.driver_payout_requests(
    driver_user_id,requested_amount,status,payout_method,payout_account_snapshot,driver_note
  ) values(
    v_actor,round(p_amount,2),'pending',nullif(left(coalesce(p_payout_method,''),40),''),
    case when jsonb_typeof(p_account_snapshot)='object' then p_account_snapshot else null end,
    nullif(left(coalesce(p_driver_note,''),300),'')
  ) returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.driver_request_payout(numeric,text,jsonb,text) from public,anon;
grant execute on function public.driver_request_payout(numeric,text,jsonb,text) to authenticated;

-- Build one merchant statement from delivered, unbilled entries only.
create or replace function public.admin_create_merchant_billing_statement(
  p_merchant_id uuid,p_period_start date,p_period_end date,p_admin_note text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_statement_id uuid;
  v_total numeric(12,2);
  v_entry_ids uuid[];
begin
  if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if p_merchant_id is null or p_period_start is null or p_period_end is null or p_period_end<p_period_start then
    raise exception 'Choose a valid merchant and billing period.';
  end if;
  perform 1 from public.merchants where id=p_merchant_id and status='approved' for update;
  if not found then raise exception 'Approved merchant not found.'; end if;

  select coalesce(sum(e.system_usage_amount),0),array_agg(e.id) into v_total,v_entry_ids
    from (
      select e.id,e.system_usage_amount
      from public.merchant_system_usage_entries e
      where e.merchant_id=p_merchant_id and e.status='unbilled'
        and e.order_date between p_period_start and p_period_end
      for update
    ) e;
  if v_total<=0 then raise exception 'No unbilled System Usage entries exist for this merchant and period.'; end if;

  insert into public.merchant_billing_statements(
    merchant_id,period_start,period_end,total_system_usage,status,created_by,admin_note
  ) values(p_merchant_id,p_period_start,p_period_end,v_total,'issued',v_actor,
    nullif(left(coalesce(p_admin_note,''),500),'')) returning id into v_statement_id;

  update public.merchant_system_usage_entries set statement_id=v_statement_id,status='billed'
    where id=any(v_entry_ids);
  return v_statement_id;
end;
$$;

revoke all on function public.admin_create_merchant_billing_statement(uuid,date,date,text) from public,anon;
grant execute on function public.admin_create_merchant_billing_statement(uuid,date,date,text) to authenticated;

-- Restrict payout review transitions to Admin and keep the audit fields consistent.
create or replace function public.admin_review_driver_payout(
  p_request_id uuid,p_next_status text,p_payment_reference text default null,p_admin_note text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_request public.driver_payout_requests%rowtype;
begin
  if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if p_next_status not in ('approved','rejected','paid') then raise exception 'Invalid payout status.'; end if;
  select * into v_request from public.driver_payout_requests where id=p_request_id for update;
  if not found then raise exception 'Payout request not found.'; end if;
  if (p_next_status='approved' and v_request.status<>'pending')
    or (p_next_status='rejected' and v_request.status not in ('pending','approved'))
    or (p_next_status='paid' and v_request.status<>'approved') then
    raise exception 'This payout request cannot move to the selected status.';
  end if;
  update public.driver_payout_requests set status=p_next_status,
    reviewed_at=case when p_next_status in ('approved','rejected') then now() else reviewed_at end,
    reviewed_by=case when p_next_status in ('approved','rejected') then v_actor else reviewed_by end,
    paid_at=case when p_next_status='paid' then now() else paid_at end,
    paid_by=case when p_next_status='paid' then v_actor else paid_by end,
    payment_reference=case when p_next_status='paid' then nullif(left(coalesce(p_payment_reference,''),120),'') else payment_reference end,
    admin_note=coalesce(nullif(left(coalesce(p_admin_note,''),500),''),admin_note)
  where id=p_request_id;
end;
$$;

revoke all on function public.admin_review_driver_payout(uuid,text,text,text) from public,anon;
grant execute on function public.admin_review_driver_payout(uuid,text,text,text) to authenticated;

grant execute on function public.driver_request_payout(numeric,text,jsonb,text) to authenticated;
grant execute on function public.admin_create_merchant_billing_statement(uuid,date,date,text) to authenticated;
grant execute on function public.admin_review_driver_payout(uuid,text,text,text) to authenticated;
