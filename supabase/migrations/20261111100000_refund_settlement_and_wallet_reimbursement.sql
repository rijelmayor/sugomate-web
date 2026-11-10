-- Refund settlement completion: customer choice, merchant-to-platform remittance,
-- automatic wallet-paid refunds, merchant reimbursement liabilities, and full audit.
alter table public.order_refund_cases
  add column if not exists settlement_reference text,
  add column if not exists settlement_proof_path text,
  add column if not exists settlement_submitted_at timestamptz,
  add column if not exists merchant_reimbursement_status text not null default 'not_applicable'
    check (merchant_reimbursement_status in ('not_applicable','payable_to_platform','submitted','verified','rejected')),
  add column if not exists customer_choice_at timestamptz;

alter table public.order_refund_cases drop constraint if exists order_refund_cases_status_check;
alter table public.order_refund_cases add constraint order_refund_cases_status_check
  check (status in ('awaiting_customer_choice','requested','awaiting_merchant','evidence_submitted',
    'wallet_remittance_pending','wallet_remittance_submitted','wallet_credit_pending',
    'awaiting_customer_confirmation','disputed','refunded_directly','credited_to_wallet','rejected'));

create table if not exists public.merchant_reimbursement_obligations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  refund_case_id uuid not null unique references public.order_refund_cases(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  status text not null default 'payable_to_platform'
    check(status in ('payable_to_platform','submitted','verified','rejected')),
  settlement_reference text,
  settlement_proof_path text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.merchant_reimbursement_obligations enable row level security;
drop policy if exists "merchant reads own reimbursement obligations" on public.merchant_reimbursement_obligations;
create policy "merchant reads own reimbursement obligations" on public.merchant_reimbursement_obligations
for select to authenticated using (
 exists(select 1 from public.merchant_members mm where mm.merchant_id=merchant_reimbursement_obligations.merchant_id and mm.user_id=auth.uid())
);
revoke insert,update,delete on public.merchant_reimbursement_obligations from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merchant-refund-proofs','merchant-refund-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "merchant uploads own refund evidence" on storage.objects;
create policy "merchant uploads own refund evidence" on storage.objects
for insert to authenticated with check (
 bucket_id='merchant-refund-proofs'
 and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.merchant_members mm where mm.user_id=auth.uid())
);
drop policy if exists "merchant reads own refund evidence" on storage.objects;
create policy "merchant reads own refund evidence" on storage.objects
for select to authenticated using (
 bucket_id='merchant-refund-proofs'
 and (storage.foldername(name))[1]=auth.uid()::text
);
drop policy if exists "customer reads own direct refund evidence" on storage.objects;
create policy "customer reads own refund evidence" on storage.objects
for select to authenticated using (
 bucket_id='merchant-refund-proofs'
 and exists(select 1 from public.order_refund_cases rc
   where rc.customer_id=auth.uid()
     and (rc.merchant_proof_path=name or rc.settlement_proof_path=name)
     and rc.status in ('evidence_submitted','wallet_remittance_submitted','wallet_credit_pending','credited_to_wallet','refunded_directly'))
);

-- Create the customer action item immediately on merchant cancellation.
-- Wallet-paid orders are refunded atomically because SUGOMATE already holds the funds;
-- merchant reimbursement is separately tracked as payable to the platform.
create or replace function public.handle_paid_order_cancellation_refund()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_case uuid; v_wallet public.customer_wallets%rowtype; v_tx uuid;
begin
 if new.status not in ('cancelled','rejected') or old.status is not distinct from new.status
    or new.payment_status not in ('paid','completed') then return new; end if;
 if new.payment_method not in ('gcash','wallet') then return new; end if;
 if exists(select 1 from public.order_refund_cases where order_id=new.id) then return new; end if;

 insert into public.order_refund_cases(order_id,customer_id,merchant_id,requested_amount,
   refund_method_preference,settlement_method,status,merchant_reimbursement_status)
 values(new.id,new.customer_id,new.merchant_id,new.total,null,
   case when new.payment_method='wallet' then 'sugomate_wallet' else null end,
   case when new.payment_method='wallet' then 'credited_to_wallet' else 'awaiting_customer_choice' end,
   case when new.payment_method='wallet' then 'payable_to_platform' else 'not_applicable' end)
 returning id into v_case;

 if new.payment_method='wallet' then
   insert into public.customer_wallets(customer_id) values(new.customer_id) on conflict(customer_id) do nothing;
   select * into v_wallet from public.customer_wallets where customer_id=new.customer_id for update;
   update public.customer_wallets set available_balance=available_balance+new.total,updated_at=now()
    where customer_id=new.customer_id returning * into v_wallet;
   insert into public.wallet_transactions(customer_id,transaction_type,direction,amount,
     available_balance_after,reserved_balance_after,reference_type,reference_id,idempotency_key,description)
   values(new.customer_id,'refund','credit',new.total,v_wallet.available_balance,v_wallet.reserved_balance,
     'order_refund_case',v_case,'refund:'||v_case::text,
     'Automatic wallet refund for cancelled order '||coalesce(new.order_number,new.id::text))
   returning id into v_tx;
   update public.order_refund_cases set wallet_transaction_id=v_tx,reviewed_at=now()
    where id=v_case;
   insert into public.merchant_reimbursement_obligations(merchant_id,order_id,refund_case_id,amount)
    values(new.merchant_id,new.id,v_case,new.total);
   insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
    values(null,'system','wallet_order_auto_refunded','order_refund_case',v_case,
      jsonb_build_object('order_id',new.id,'amount',new.total,'merchant_id',new.merchant_id,
        'merchant_reimbursement','payable_to_platform','wallet_transaction_id',v_tx));
 else
   insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
    values(null,'system','gcash_order_refund_choice_required','order_refund_case',v_case,
      jsonb_build_object('order_id',new.id,'amount',new.total,'merchant_id',new.merchant_id));
 end if;
 return new;
end $$;
drop trigger if exists paid_order_cancellation_refund on public.orders;
create trigger paid_order_cancellation_refund
after update of status on public.orders
for each row execute function public.handle_paid_order_cancellation_refund();

-- Customer selects a refund route only after a GCash-paid order is cancelled.
create or replace function public.customer_request_order_refund(p_order_id uuid,p_method text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype; v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_method not in ('direct_gcash','sugomate_wallet') then raise exception 'invalid_refund_method'; end if;
 select rc.* into v_case from public.order_refund_cases rc
 join public.orders o on o.id=rc.order_id
 where rc.order_id=p_order_id and rc.customer_id=auth.uid()
   and o.payment_method='gcash' and rc.status='awaiting_customer_choice'
 for update of rc;
 if not found then raise exception 'refund_choice_not_available'; end if;
 update public.order_refund_cases set refund_method_preference=p_method,settlement_method=p_method,
   status=case when p_method='direct_gcash' then 'awaiting_merchant' else 'wallet_remittance_pending' end,
   merchant_reimbursement_status=case when p_method='sugomate_wallet' then 'payable_to_platform' else 'not_applicable' end,
   customer_choice_at=now(),updated_at=now()
 where id=v_case.id returning id into v_id;
 if p_method='sugomate_wallet' then
   insert into public.merchant_reimbursement_obligations(merchant_id,order_id,refund_case_id,amount)
   values(v_case.merchant_id,v_case.order_id,v_case.id,v_case.requested_amount)
   on conflict(refund_case_id) do nothing;
 end if;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(auth.uid(),'customer','refund_method_selected','order_refund_case',v_id,
   jsonb_build_object('method',p_method,'amount',v_case.requested_amount));
 return v_id;
end $$;

-- Merchant evidence RPC supports both direct customer GCash transfer and remittance to SUGOMATE.
create or replace function public.merchant_submit_direct_gcash_refund_evidence(
 p_case_id uuid,p_reference text,p_proof_path text
) returns void language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype; v_next text;
begin
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or not exists(select 1 from public.merchant_members mm where mm.merchant_id=v_case.merchant_id and mm.user_id=auth.uid()) then
   raise exception 'refund_case_not_found';
 end if;
 if length(trim(coalesce(p_reference,'')))<4 or p_proof_path not like auth.uid()::text||'/%' then
   raise exception 'invalid_refund_evidence';
 end if;
 if v_case.status='awaiting_merchant' and v_case.settlement_method='direct_gcash' then
   v_next:='evidence_submitted';
 elsif v_case.status='wallet_remittance_pending' and v_case.settlement_method='sugomate_wallet' then
   v_next:='wallet_remittance_submitted';
 else raise exception 'refund_not_awaiting_merchant'; end if;
 update public.order_refund_cases set merchant_reference=trim(p_reference),
   merchant_proof_path=case when v_case.settlement_method='direct_gcash' then p_proof_path else merchant_proof_path end,
   settlement_reference=case when v_case.settlement_method='sugomate_wallet' then trim(p_reference) else settlement_reference end,
   settlement_proof_path=case when v_case.settlement_method='sugomate_wallet' then p_proof_path else settlement_proof_path end,
   settlement_submitted_at=case when v_case.settlement_method='sugomate_wallet' then now() else settlement_submitted_at end,
   merchant_reimbursement_status=case when v_case.settlement_method='sugomate_wallet' then 'submitted' else merchant_reimbursement_status end,
   status=v_next,updated_at=now() where id=p_case_id;
 if v_case.settlement_method='sugomate_wallet' then
   update public.merchant_reimbursement_obligations set status='submitted',
     settlement_reference=trim(p_reference),settlement_proof_path=p_proof_path,updated_at=now()
   where refund_case_id=p_case_id;
 end if;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(auth.uid(),'merchant',case when v_case.settlement_method='direct_gcash'
   then 'direct_gcash_refund_evidence_submitted' else 'merchant_refund_remittance_submitted' end,
   'order_refund_case',p_case_id,jsonb_build_object('reference',p_reference,'method',v_case.settlement_method));
end $$;

-- Admin verifies merchant remittance before customer wallet is credited.
create or replace function public.admin_credit_wallet_refund(p_case_id uuid,p_admin_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype; v_wallet public.customer_wallets%rowtype; v_tx uuid;
begin
 if not exists(select 1 from public.user_roles where user_id=p_admin_id and role='admin') then raise exception 'admin_required'; end if;
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or v_case.settlement_method<>'sugomate_wallet'
   or v_case.status<>'wallet_remittance_submitted' or v_case.settlement_proof_path is null then
   raise exception 'wallet_refund_remittance_not_verified';
 end if;
 if exists(select 1 from public.wallet_transactions where idempotency_key='refund:'||v_case.id::text) then
   raise exception 'refund_already_credited';
 end if;
 insert into public.customer_wallets(customer_id) values(v_case.customer_id) on conflict(customer_id) do nothing;
 select * into v_wallet from public.customer_wallets where customer_id=v_case.customer_id for update;
 update public.customer_wallets set available_balance=available_balance+v_case.requested_amount,updated_at=now()
 where customer_id=v_case.customer_id returning * into v_wallet;
 insert into public.wallet_transactions(customer_id,transaction_type,direction,amount,available_balance_after,
   reserved_balance_after,reference_type,reference_id,idempotency_key,description,created_by)
 values(v_case.customer_id,'refund','credit',v_case.requested_amount,v_wallet.available_balance,v_wallet.reserved_balance,
   'order_refund_case',v_case.id,'refund:'||v_case.id::text,'GCash refund credited to SUGOMATE Wallet for order '||v_case.order_id::text,p_admin_id)
 returning id into v_tx;
 update public.order_refund_cases set status='credited_to_wallet',wallet_transaction_id=v_tx,
   reviewed_by=p_admin_id,reviewed_at=now(),updated_at=now(),merchant_reimbursement_status='verified'
 where id=v_case.id;
 update public.merchant_reimbursement_obligations set status='verified',verified_by=p_admin_id,
   verified_at=now(),updated_at=now() where refund_case_id=v_case.id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(p_admin_id,'admin','gcash_refund_remittance_verified_wallet_credited','order_refund_case',v_case.id,
   jsonb_build_object('amount',v_case.requested_amount,'transaction_id',v_tx,'merchant_id',v_case.merchant_id));
 return v_tx;
end $$;

-- Direct GCash confirmation remains customer-controlled.
create or replace function public.customer_confirm_direct_gcash_refund(p_case_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype;
begin
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or v_case.customer_id<>auth.uid() then raise exception 'refund_case_not_found'; end if;
 if v_case.settlement_method<>'direct_gcash' or v_case.status<>'evidence_submitted'
    or v_case.merchant_proof_path is null then raise exception 'refund_evidence_not_ready'; end if;
 update public.order_refund_cases set status='refunded_directly',customer_confirmed_at=now(),updated_at=now()
 where id=p_case_id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id)
 values(auth.uid(),'customer','direct_gcash_refund_confirmed','order_refund_case',p_case_id);
end $$;

revoke all on function public.customer_request_order_refund(uuid,text) from public,anon;
revoke all on function public.merchant_submit_direct_gcash_refund_evidence(uuid,text,text) from public,anon;
revoke all on function public.customer_confirm_direct_gcash_refund(uuid) from public,anon;
revoke all on function public.admin_credit_wallet_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.customer_request_order_refund(uuid,text) to authenticated;
grant execute on function public.merchant_submit_direct_gcash_refund_evidence(uuid,text,text) to authenticated;
grant execute on function public.customer_confirm_direct_gcash_refund(uuid) to authenticated;
grant execute on function public.admin_credit_wallet_refund(uuid,uuid) to service_role;
