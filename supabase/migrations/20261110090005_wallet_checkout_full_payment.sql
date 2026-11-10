-- Full-wallet checkout for web customers. The existing order RPC remains the
-- authoritative calculator for product prices, stock, branch, route and delivery fee.
-- This wrapper creates the order and debits the wallet in one transaction; an
-- insufficient balance rolls back the order as well.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method = any (array['cod'::text,'gcash'::text,'wallet'::text]));

create or replace function public.place_customer_order_with_wallet(
  p_address_id uuid,
  p_items jsonb,
  p_customer_note text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := auth.uid();
  v_order_id uuid;
  v_order public.orders%rowtype;
  v_wallet public.customer_wallets%rowtype;
begin
  if v_customer is null then raise exception 'You must be signed in.'; end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id=v_customer and ur.role='customer'::public.app_role
  ) then raise exception 'Only customer accounts can place orders.'; end if;

  -- Reuse the existing validated order engine. The temporary COD value is never
  -- visible outside this transaction and is replaced before the order commits.
  v_order_id := public.place_customer_order(p_address_id,p_items,'cod',p_customer_note);
  select * into v_order from public.orders
    where id=v_order_id and customer_id=v_customer for update;
  if not found then raise exception 'Wallet checkout order could not be loaded.'; end if;

  select * into v_wallet from public.customer_wallets
    where customer_id=v_customer for update;
  if not found or v_wallet.available_balance < v_order.total then
    raise exception 'Insufficient wallet balance. Add funds or choose another payment method.';
  end if;

  update public.customer_wallets
    set available_balance=available_balance-v_order.total, updated_at=now()
    where customer_id=v_customer returning * into v_wallet;

  update public.orders
    set payment_method='wallet', payment_status='paid', updated_at=now()
    where id=v_order_id;

  insert into public.wallet_transactions(
    customer_id,transaction_type,direction,amount,available_balance_after,
    reserved_balance_after,reference_type,reference_id,idempotency_key,description
  ) values (
    v_customer,'purchase','debit',v_order.total,v_wallet.available_balance,
    v_wallet.reserved_balance,'order',v_order_id,'order-wallet:'||v_order_id::text,
    'Full wallet payment for order '||coalesce(v_order.order_number,v_order_id::text)
  );

  insert into public.wallet_audit_events(
    actor_user_id,actor_role,event_type,entity_type,entity_id,details
  ) values (
    v_customer,'customer','wallet_order_paid','order',v_order_id,
    jsonb_build_object('amount',v_order.total,'order_number',v_order.order_number)
  );
  return v_order_id;
end;
$$;

revoke all on function public.place_customer_order_with_wallet(uuid,jsonb,text) from public,anon;
grant execute on function public.place_customer_order_with_wallet(uuid,jsonb,text) to authenticated;
comment on function public.place_customer_order_with_wallet(uuid,jsonb,text) is
  'Atomically creates an order using the existing order pricing/stock checks and fully pays it from the customer wallet.';
