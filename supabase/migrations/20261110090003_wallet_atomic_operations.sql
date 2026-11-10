-- Atomic wallet operations. These functions are callable only by the trusted service role.
create or replace function public.wallet_admin_credit_topup(
  p_request_id uuid,
  p_admin_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.wallet_top_up_requests%rowtype;
  v_wallet public.customer_wallets%rowtype;
  v_tx uuid;
begin
  if not exists(select 1 from public.user_roles where user_id=p_admin_id and role='admin') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  select * into v_request from public.wallet_top_up_requests where id=p_request_id for update;
  if not found or v_request.status <> 'otp_pending' then
    raise exception 'topup_not_pending';
  end if;
  if exists(select 1 from public.wallet_transactions where idempotency_key='topup:'||v_request.id::text) then
    raise exception 'topup_already_credited';
  end if;
  insert into public.customer_wallets(customer_id) values(v_request.customer_id)
    on conflict(customer_id) do nothing;
  select * into v_wallet from public.customer_wallets where customer_id=v_request.customer_id for update;
  update public.customer_wallets
    set available_balance=available_balance+v_request.amount, updated_at=now()
    where customer_id=v_request.customer_id
    returning * into v_wallet;
  insert into public.wallet_transactions(
    customer_id,transaction_type,direction,amount,available_balance_after,reserved_balance_after,
    reference_type,reference_id,idempotency_key,description,created_by
  ) values (
    v_request.customer_id,'top_up','credit',v_request.amount,v_wallet.available_balance,
    v_wallet.reserved_balance,'top_up_request',v_request.id,'topup:'||v_request.id::text,
    'Approved customer wallet top-up',p_admin_id
  ) returning id into v_tx;
  update public.wallet_top_up_requests set status='approved', reviewed_by=p_admin_id,
    reviewed_at=now(), credited_transaction_id=v_tx, updated_at=now()
    where id=v_request.id;
  insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
    values(p_admin_id,'admin','wallet_topup_credited','top_up_request',v_request.id,
      jsonb_build_object('amount',v_request.amount,'transaction_id',v_tx));
  return v_tx;
end;
$$;

create or replace function public.wallet_customer_request_withdrawal(
  p_customer_id uuid, p_amount numeric, p_payout_method text,
  p_account_name text, p_account_number text, p_bank_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_wallet public.customer_wallets%rowtype; v_id uuid;
begin
  if p_amount <= 0 or p_amount > 100000 or p_payout_method not in ('gcash','bank')
    or length(trim(p_account_name)) < 2 or length(trim(p_account_number)) < 5 then
    raise exception 'invalid_withdrawal';
  end if;
  select * into v_wallet from public.customer_wallets where customer_id=p_customer_id for update;
  if not found or v_wallet.available_balance < p_amount then raise exception 'insufficient_wallet_balance'; end if;
  update public.customer_wallets set available_balance=available_balance-p_amount,
    reserved_balance=reserved_balance+p_amount, updated_at=now()
    where customer_id=p_customer_id returning * into v_wallet;
  insert into public.wallet_withdrawal_requests(customer_id,amount,payout_method,account_name,account_number,bank_name)
    values(p_customer_id,p_amount,p_payout_method,trim(p_account_name),trim(p_account_number),nullif(trim(p_bank_name),''))
    returning id into v_id;
  insert into public.wallet_transactions(customer_id,transaction_type,direction,amount,
    available_balance_after,reserved_balance_after,reference_type,reference_id,idempotency_key,description)
    values(p_customer_id,'withdrawal_reserve','debit',p_amount,v_wallet.available_balance,
      v_wallet.reserved_balance,'withdrawal_request',v_id,'withdrawal-reserve:'||v_id::text,
      'Wallet funds reserved for withdrawal');
  insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id)
    values(p_customer_id,'customer','withdrawal_requested','withdrawal_request',v_id);
  return v_id;
end;
$$;

create or replace function public.wallet_admin_review_withdrawal(
  p_request_id uuid,p_admin_id uuid,p_decision text,p_payment_reference text default null,p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_req public.wallet_withdrawal_requests%rowtype; v_wallet public.customer_wallets%rowtype; v_type text;
begin
  if not exists(select 1 from public.user_roles where user_id=p_admin_id and role='admin') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  if p_decision not in ('paid','rejected') then raise exception 'invalid_decision'; end if;
  select * into v_req from public.wallet_withdrawal_requests where id=p_request_id for update;
  if not found or v_req.status not in ('pending','processing') then raise exception 'withdrawal_not_pending'; end if;
  if p_decision='paid' and coalesce(trim(p_payment_reference),'')='' then raise exception 'payment_reference_required'; end if;
  select * into v_wallet from public.customer_wallets where customer_id=v_req.customer_id for update;
  if v_wallet.reserved_balance < v_req.amount then raise exception 'reserved_balance_mismatch'; end if;
  if p_decision='rejected' then
    update public.customer_wallets set available_balance=available_balance+v_req.amount,
      reserved_balance=reserved_balance-v_req.amount,updated_at=now()
      where customer_id=v_req.customer_id returning * into v_wallet;
    v_type:='withdrawal_release';
  else
    update public.customer_wallets set reserved_balance=reserved_balance-v_req.amount,
      updated_at=now() where customer_id=v_req.customer_id returning * into v_wallet;
    v_type:='withdrawal_paid';
  end if;
  update public.wallet_withdrawal_requests set status=p_decision, payment_reference=nullif(trim(p_payment_reference),''),
    admin_note=nullif(trim(p_admin_note),''),reviewed_by=p_admin_id,reviewed_at=now(),updated_at=now()
    where id=p_request_id;
  insert into public.wallet_transactions(customer_id,transaction_type,direction,amount,
    available_balance_after,reserved_balance_after,reference_type,reference_id,idempotency_key,description,created_by)
    values(v_req.customer_id,v_type,case when p_decision='rejected' then 'credit' else 'debit' end,
      v_req.amount,v_wallet.available_balance,v_wallet.reserved_balance,'withdrawal_request',v_req.id,
      v_type||':'||v_req.id::text,case when p_decision='rejected' then 'Rejected withdrawal; reserved funds returned' else 'Withdrawal paid' end,p_admin_id);
  insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
    values(p_admin_id,'admin','withdrawal_'||p_decision,'withdrawal_request',v_req.id,
      jsonb_build_object('amount',v_req.amount,'payment_reference',p_payment_reference));
end;
$$;

revoke all on function public.wallet_admin_credit_topup(uuid,uuid) from public,anon,authenticated;
revoke all on function public.wallet_customer_request_withdrawal(uuid,numeric,text,text,text,text) from public,anon,authenticated;
revoke all on function public.wallet_admin_review_withdrawal(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.wallet_admin_credit_topup(uuid,uuid) to service_role;
grant execute on function public.wallet_customer_request_withdrawal(uuid,numeric,text,text,text,text) to service_role;
grant execute on function public.wallet_admin_review_withdrawal(uuid,uuid,text,text,text) to service_role;
