-- Complete the two approved refund paths:
-- 1) GCash: merchant submits transfer evidence; customer confirms receipt.
-- 2) Wallet: Admin authorizes an idempotent wallet ledger credit.
create table if not exists public.order_refund_cases (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  merchant_id uuid not null references auth.users(id) on delete restrict,
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  refund_method_preference text check (refund_method_preference in ('direct_gcash','sugomate_wallet')),
  settlement_method text check (settlement_method in ('direct_gcash','sugomate_wallet')),
  status text not null default 'requested'
    check (status in ('requested','awaiting_merchant','evidence_submitted','awaiting_customer_confirmation','disputed','wallet_credit_pending','refunded_directly','credited_to_wallet','rejected')),
  merchant_reference text,
  merchant_proof_path text,
  customer_confirmed_at timestamptz,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_refund_cases_one_settlement check (not (status='refunded_directly' and wallet_transaction_id is not null))
);
create unique index if not exists order_refund_one_open_case_per_order
  on public.order_refund_cases(order_id)
  where status not in ('refunded_directly','credited_to_wallet','rejected');

alter table public.order_refund_cases enable row level security;
drop policy if exists "wallet customer read own refund cases" on public.order_refund_cases;
create policy "wallet customer read own refund cases" on public.order_refund_cases
for select to authenticated using (customer_id=auth.uid());
drop policy if exists "merchant reads own refund cases" on public.order_refund_cases;
create policy "merchant reads own refund cases" on public.order_refund_cases
for select to authenticated using (exists(select 1 from public.merchant_members mm where mm.merchant_id=order_refund_cases.merchant_id and mm.user_id=auth.uid()));
revoke insert,update,delete on public.order_refund_cases from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merchant-refund-proofs','merchant-refund-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "merchant uploads own refund evidence" on storage.objects;
create policy "merchant uploads own refund evidence" on storage.objects
for insert to authenticated with check (
 bucket_id='merchant-refund-proofs'
 and (storage.foldername(name))[1]=auth.uid()::text
 and exists(select 1 from public.user_roles ur where ur.user_id=auth.uid() and ur.role='merchant')
);
drop policy if exists "merchant reads own refund evidence" on storage.objects;
create policy "merchant reads own refund evidence" on storage.objects
for select to authenticated using (
 bucket_id='merchant-refund-proofs'
 and (storage.foldername(name))[1]=auth.uid()::text
);

create or replace function public.customer_request_order_refund(p_order_id uuid,p_method text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_id uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_method not in ('direct_gcash','sugomate_wallet') then raise exception 'invalid_refund_method'; end if;
 select * into v_order from public.orders where id=p_order_id and customer_id=auth.uid() for update;
 if not found then raise exception 'order_not_found'; end if;
 if v_order.status not in ('cancelled','rejected') then raise exception 'order_not_cancelled'; end if;
 if v_order.payment_status not in ('paid','completed') then raise exception 'payment_not_collected'; end if;
 if exists(select 1 from public.order_refund_cases where order_id=v_order.id and status in ('refunded_directly','credited_to_wallet')) then raise exception 'refund_already_settled'; end if;
 if (p_method='direct_gcash' and v_order.payment_method<>'gcash')
    or (p_method='sugomate_wallet' and v_order.payment_method<>'wallet') then
   raise exception 'refund_method_mismatch';
 end if;
 insert into public.order_refund_cases(order_id,customer_id,merchant_id,requested_amount,refund_method_preference,settlement_method,status)
 values(v_order.id,v_order.customer_id,v_order.merchant_id,v_order.total,p_method,p_method,
   case when p_method='direct_gcash' then 'awaiting_merchant' else 'wallet_credit_pending' end)
 returning id into v_id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(auth.uid(),'customer','refund_requested','order_refund_case',v_id,jsonb_build_object('order_id',p_order_id,'method',p_method,'amount',v_order.total));
 return v_id;
exception when unique_violation then raise exception 'refund_already_requested';
end $$;

create or replace function public.merchant_submit_direct_gcash_refund_evidence(
 p_case_id uuid,p_reference text,p_proof_path text
) returns void language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype;
begin
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or not exists(select 1 from public.merchant_members mm where mm.merchant_id=v_case.merchant_id and mm.user_id=auth.uid()) then raise exception 'refund_case_not_found'; end if;
 if v_case.settlement_method<>'direct_gcash' or v_case.status<>'awaiting_merchant' then raise exception 'refund_not_awaiting_evidence'; end if;
 if length(trim(coalesce(p_reference,'')))<4 or p_proof_path not like auth.uid()::text||'/%' then raise exception 'invalid_refund_evidence'; end if;
 update public.order_refund_cases set merchant_reference=trim(p_reference),merchant_proof_path=p_proof_path,
   status='evidence_submitted',updated_at=now() where id=p_case_id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(auth.uid(),'merchant','direct_gcash_refund_evidence_submitted','order_refund_case',p_case_id,
 jsonb_build_object('reference',p_reference));
end $$;

create or replace function public.customer_confirm_direct_gcash_refund(p_case_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype;
begin
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or v_case.customer_id<>auth.uid() then raise exception 'refund_case_not_found'; end if;
 if v_case.settlement_method<>'direct_gcash' or v_case.status<>'evidence_submitted' or v_case.merchant_proof_path is null then
   raise exception 'refund_evidence_not_ready';
 end if;
 update public.order_refund_cases set status='refunded_directly',customer_confirmed_at=now(),updated_at=now() where id=p_case_id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id)
 values(auth.uid(),'customer','direct_gcash_refund_confirmed','order_refund_case',p_case_id);
end $$;

create or replace function public.admin_credit_wallet_refund(p_case_id uuid,p_admin_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_case public.order_refund_cases%rowtype; v_wallet public.customer_wallets%rowtype; v_tx uuid;
begin
 if not exists(select 1 from public.user_roles where user_id=p_admin_id and role='admin') then raise exception 'admin_required'; end if;
 select * into v_case from public.order_refund_cases where id=p_case_id for update;
 if not found or v_case.settlement_method<>'sugomate_wallet' or v_case.status<>'wallet_credit_pending' then
   raise exception 'wallet_refund_not_pending';
 end if;
 if exists(select 1 from public.wallet_transactions where idempotency_key='refund:'||v_case.id::text) then raise exception 'refund_already_credited'; end if;
 insert into public.customer_wallets(customer_id) values(v_case.customer_id) on conflict(customer_id) do nothing;
 select * into v_wallet from public.customer_wallets where customer_id=v_case.customer_id for update;
 update public.customer_wallets set available_balance=available_balance+v_case.requested_amount,updated_at=now()
 where customer_id=v_case.customer_id returning * into v_wallet;
 insert into public.wallet_transactions(customer_id,transaction_type,direction,amount,available_balance_after,reserved_balance_after,
 reference_type,reference_id,idempotency_key,description,created_by)
 values(v_case.customer_id,'refund','credit',v_case.requested_amount,v_wallet.available_balance,v_wallet.reserved_balance,
 'order_refund_case',v_case.id,'refund:'||v_case.id::text,'Refund for cancelled order '||v_case.order_id::text,p_admin_id)
 returning id into v_tx;
 update public.order_refund_cases set status='credited_to_wallet',wallet_transaction_id=v_tx,reviewed_by=p_admin_id,
 reviewed_at=now(),updated_at=now() where id=v_case.id;
 insert into public.wallet_audit_events(actor_user_id,actor_role,event_type,entity_type,entity_id,details)
 values(p_admin_id,'admin','wallet_refund_credited','order_refund_case',v_case.id,
 jsonb_build_object('amount',v_case.requested_amount,'transaction_id',v_tx));
 return v_tx;
end $$;

revoke all on function public.customer_request_order_refund(uuid,text) from public,anon;
revoke all on function public.merchant_submit_direct_gcash_refund_evidence(uuid,text,text) from public,anon;
revoke all on function public.customer_confirm_direct_gcash_refund(uuid) from public,anon;
revoke all on function public.admin_credit_wallet_refund(uuid,uuid) from public,anon,authenticated;
grant execute on function public.customer_request_order_refund(uuid,text) to authenticated;
grant execute on function public.merchant_submit_direct_gcash_refund_evidence(uuid,text,text) to authenticated;
grant execute on function public.customer_confirm_direct_gcash_refund(uuid) to authenticated;
grant execute on function public.admin_credit_wallet_refund(uuid,uuid) to service_role;

drop policy if exists "customer reads own direct refund evidence" on storage.objects;
create policy "customer reads own direct refund evidence" on storage.objects
for select to authenticated using (
 bucket_id='merchant-refund-proofs'
 and exists (
   select 1 from public.order_refund_cases rc
   where rc.customer_id=auth.uid()
     and rc.merchant_proof_path=name
     and rc.status in ('evidence_submitted','refunded_directly')
 )
);
