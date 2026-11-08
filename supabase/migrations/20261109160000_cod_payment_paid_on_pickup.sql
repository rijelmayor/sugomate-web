-- COD is considered settled when the rider confirms physical pickup.
-- This is the merchant handover point: merchants do not release COD goods
-- until payment has been collected/settled at the counter.

alter table public.orders
  add column if not exists cod_payment_confirmed_at timestamptz,
  add column if not exists cod_payment_confirmed_by uuid references auth.users(id);

create or replace function public.driver_update_order_status(
  p_order_id uuid,
  p_next_status text,
  p_proof_path text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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
    cod_payment_confirmed_at=case
      when p_next_status='picked_up' and lower(coalesce(payment_method,''))='cod'
        then coalesce(cod_payment_confirmed_at,now())
      else cod_payment_confirmed_at end,
    cod_payment_confirmed_by=case
      when p_next_status='picked_up' and lower(coalesce(payment_method,''))='cod'
        then coalesce(cod_payment_confirmed_by,v_actor)
      else cod_payment_confirmed_by end,
    payment_status=case
      when p_next_status='picked_up' and lower(coalesce(payment_method,''))='cod'
        then 'paid'
      else payment_status end,
    delivered_at=case when p_next_status='delivered' then now() else delivered_at end,
    delivery_proof_path=case when p_next_status='delivered' then p_proof_path else delivery_proof_path end,
    driver_note=coalesce(nullif(left(coalesce(p_note,''),500),''),driver_note),
    updated_at=now()
  where id=p_order_id;

  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,p_next_status,v_actor,
    coalesce(
      nullif(left(coalesce(p_note,''),500),''),
      case
        when p_next_status='picked_up' and lower(coalesce(v_order.payment_method,''))='cod'
          then 'COD payment confirmed at merchant handover when rider picked up the order'
        when p_next_status='delivered' then 'Delivery completed with photo proof'
        else 'Delivery status updated by partner'
      end
    ));

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
$function$;

-- Reconcile legacy orders that already crossed the pickup milestone.
-- Never mark an order paid merely because it was created or accepted.
update public.orders
set payment_status='paid',
    cod_payment_confirmed_at=coalesce(cod_payment_confirmed_at,picked_up_at),
    cod_payment_confirmed_by=coalesce(cod_payment_confirmed_by,driver_user_id),
    updated_at=now()
where lower(coalesce(payment_method,''))='cod'
  and payment_status<>'paid'
  and picked_up_at is not null
  and status in ('picked_up','in_transit','delivered');
