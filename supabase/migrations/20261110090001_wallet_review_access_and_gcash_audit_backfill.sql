-- Read-only role access for review queues. All state transitions stay in trusted server code.
drop policy if exists "admin reads topup requests" on public.wallet_top_up_requests;
create policy "admin reads topup requests" on public.wallet_top_up_requests
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists "admin reads withdrawal requests" on public.wallet_withdrawal_requests;
create policy "admin reads withdrawal requests" on public.wallet_withdrawal_requests
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists "admin reads refund cases" on public.order_refund_cases;
create policy "admin reads refund cases" on public.order_refund_cases
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists "merchant reads own refund cases" on public.order_refund_cases;
create policy "merchant reads own refund cases" on public.order_refund_cases
for select to authenticated using (merchant_id = auth.uid());

-- Preserve currently submitted GCash evidence when this audit layer is introduced.
insert into public.gcash_payment_proof_history (
  order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
  submitted_at, verified_at, verified_by, verification_status
)
select o.id, o.customer_id, o.merchant_id, o.gcash_payment_reference,
       o.gcash_payment_proof_path, greatest(coalesce(o.total,0),0.01),
       coalesce(o.gcash_payment_submitted_at, o.placed_at, now()),
       o.gcash_payment_verified_at, o.gcash_payment_verified_by,
       case when o.gcash_payment_verified_at is not null then 'verified' else 'submitted' end
from public.orders o
where o.gcash_payment_proof_path is not null
  and not exists (
    select 1 from public.gcash_payment_proof_history h
    where h.order_id = o.id and h.proof_path = o.gcash_payment_proof_path
  );
