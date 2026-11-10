-- SUGOMATE web wallet, refunds, top-ups, withdrawals and GCash audit foundation.
-- Financial mutations are intentionally service-role/RPC only. Never write balances from the browser.

create table if not exists public.customer_wallets (
  customer_id uuid primary key references auth.users(id) on delete restrict,
  currency text not null default 'PHP' check (currency = 'PHP'),
  available_balance numeric(12,2) not null default 0 check (available_balance >= 0),
  reserved_balance numeric(12,2) not null default 0 check (reserved_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('top_up','refund','purchase','withdrawal_reserve','withdrawal_release','withdrawal_paid','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  amount numeric(12,2) not null check (amount > 0),
  available_balance_after numeric(12,2) not null check (available_balance_after >= 0),
  reserved_balance_after numeric(12,2) not null check (reserved_balance_after >= 0),
  reference_type text,
  reference_id uuid,
  idempotency_key text not null unique,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_customer_created_idx
  on public.wallet_transactions(customer_id, created_at desc);

create table if not exists public.wallet_top_up_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('gcash','bank')),
  payment_reference text not null check (length(trim(payment_reference)) between 4 and 120),
  proof_path text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review','otp_pending','approved','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  credited_transaction_id uuid references public.wallet_transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_top_up_approved_has_credit check (status <> 'approved' or credited_transaction_id is not null)
);

create index if not exists wallet_top_up_requests_status_created_idx
  on public.wallet_top_up_requests(status, created_at desc);
create index if not exists wallet_top_up_requests_customer_created_idx
  on public.wallet_top_up_requests(customer_id, created_at desc);

create table if not exists public.wallet_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  payout_method text not null check (payout_method in ('gcash','bank')),
  account_name text not null,
  account_number text not null,
  bank_name text,
  status text not null default 'pending'
    check (status in ('pending','processing','paid','rejected','cancelled')),
  payment_reference text,
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_withdrawals_status_created_idx
  on public.wallet_withdrawal_requests(status, created_at desc);
create index if not exists wallet_withdrawals_customer_created_idx
  on public.wallet_withdrawal_requests(customer_id, created_at desc);

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
  constraint order_refund_cases_one_settlement check (
    not (status = 'refunded_directly' and wallet_transaction_id is not null)
  )
);

create unique index if not exists order_refund_one_open_case_per_order
  on public.order_refund_cases(order_id)
  where status not in ('refunded_directly','credited_to_wallet','rejected');

create table if not exists public.wallet_payment_instructions (
  id uuid primary key default gen_random_uuid(),
  payment_method text not null unique check (payment_method in ('gcash','bank')),
  display_name text not null,
  account_name text not null,
  account_number text not null,
  bank_name text,
  instructions text not null default '',
  is_enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_authorization_challenges (
  id uuid primary key default gen_random_uuid(),
  top_up_request_id uuid not null references public.wallet_top_up_requests(id) on delete restrict,
  otp_hash text not null,
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_authorization_one_live_challenge
  on public.wallet_authorization_challenges(top_up_request_id)
  where consumed_at is null;

create table if not exists public.wallet_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('customer','merchant','admin','system')),
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gcash_payment_proof_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  merchant_id uuid not null references auth.users(id) on delete restrict,
  payment_reference text,
  proof_path text not null,
  amount numeric(12,2) not null check (amount > 0),
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_status text not null default 'submitted'
    check (verification_status in ('submitted','verified','rejected','superseded')),
  captured_at timestamptz not null default now()
);

create index if not exists gcash_payment_proof_history_order_idx
  on public.gcash_payment_proof_history(order_id, submitted_at desc);
create index if not exists gcash_payment_proof_history_merchant_idx
  on public.gcash_payment_proof_history(merchant_id, submitted_at desc);

-- Private evidence bucket. Existing order proof bucket remains unchanged.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wallet-topup-proofs','wallet-topup-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- RLS: customers can see their own wallet data and create requests; financial state
-- changes and all reviews are performed only by trusted server-side service-role code.
alter table public.customer_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_top_up_requests enable row level security;
alter table public.wallet_withdrawal_requests enable row level security;
alter table public.order_refund_cases enable row level security;
alter table public.wallet_payment_instructions enable row level security;
alter table public.wallet_authorization_challenges enable row level security;
alter table public.wallet_audit_events enable row level security;
alter table public.gcash_payment_proof_history enable row level security;

drop policy if exists "wallet customer read own account" on public.customer_wallets;
create policy "wallet customer read own account" on public.customer_wallets
for select to authenticated using (customer_id = auth.uid());

drop policy if exists "wallet customer read own transactions" on public.wallet_transactions;
create policy "wallet customer read own transactions" on public.wallet_transactions
for select to authenticated using (customer_id = auth.uid());

drop policy if exists "wallet customer read own topups" on public.wallet_top_up_requests;
create policy "wallet customer read own topups" on public.wallet_top_up_requests
for select to authenticated using (customer_id = auth.uid());

drop policy if exists "customer creates own topup request" on public.wallet_top_up_requests;
create policy "customer creates own topup request" on public.wallet_top_up_requests
for insert to authenticated with check (
  customer_id = auth.uid()
  and status = 'pending_review'
  and reviewed_by is null
  and reviewed_at is null
  and credited_transaction_id is null
);

drop policy if exists "wallet customer read own withdrawals" on public.wallet_withdrawal_requests;
create policy "wallet customer read own withdrawals" on public.wallet_withdrawal_requests
for select to authenticated using (customer_id = auth.uid());

drop policy if exists "wallet customer create own withdrawal" on public.wallet_withdrawal_requests;
create policy "wallet customer create own withdrawal" on public.wallet_withdrawal_requests
for insert to authenticated with check (
  customer_id = auth.uid() and status = 'pending'
  and reviewed_by is null and reviewed_at is null and payment_reference is null
);

drop policy if exists "wallet customer read own refund cases" on public.order_refund_cases;
create policy "wallet customer read own refund cases" on public.order_refund_cases
for select to authenticated using (customer_id = auth.uid());

drop policy if exists "wallet customer read payment instructions" on public.wallet_payment_instructions;
create policy "wallet customer read payment instructions" on public.wallet_payment_instructions
for select to authenticated using (is_enabled);

drop policy if exists "admin manages wallet payment instructions" on public.wallet_payment_instructions;
create policy "admin manages wallet payment instructions" on public.wallet_payment_instructions
for all to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
) with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists "admin reads wallet audit events" on public.wallet_audit_events;
create policy "admin reads wallet audit events" on public.wallet_audit_events
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

drop policy if exists "admin reads gcash proof history" on public.gcash_payment_proof_history;
create policy "admin reads gcash proof history" on public.gcash_payment_proof_history
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

-- Customers and merchants must not access authorization secrets or write audit/proof history.
revoke all on public.wallet_authorization_challenges from anon, authenticated;
revoke insert, update, delete on public.customer_wallets from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke update, delete on public.wallet_top_up_requests from anon, authenticated;
revoke update, delete on public.wallet_withdrawal_requests from anon, authenticated;
revoke insert, update, delete on public.order_refund_cases from anon, authenticated;
revoke insert, update, delete on public.wallet_audit_events from anon, authenticated;
revoke insert, update, delete on public.gcash_payment_proof_history from anon, authenticated;

drop policy if exists "customer uploads own wallet topup proof" on storage.objects;
create policy "customer uploads own wallet topup proof" on storage.objects
for insert to authenticated with check (
  bucket_id = 'wallet-topup-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "customer reads own wallet topup proof" on storage.objects;
create policy "customer reads own wallet topup proof" on storage.objects
for select to authenticated using (
  bucket_id = 'wallet-topup-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "admin reads wallet topup proof" on storage.objects;
create policy "admin reads wallet topup proof" on storage.objects
for select to authenticated using (
  bucket_id = 'wallet-topup-proofs'
  and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

-- GCash proof snapshot trigger preserves each submitted proof before the live order
-- pointer can be replaced. This is audit-only and does not change payment verification.
create or replace function public.capture_gcash_payment_proof_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gcash_payment_proof_path is not null
     and (tg_op = 'INSERT' or old.gcash_payment_proof_path is distinct from new.gcash_payment_proof_path) then
    insert into public.gcash_payment_proof_history (
      order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
      submitted_at, verified_at, verified_by, verification_status
    ) values (
      new.id, new.customer_id, new.merchant_id, new.gcash_payment_reference,
      new.gcash_payment_proof_path, greatest(coalesce(new.total,0),0.01),
      coalesce(new.gcash_payment_submitted_at, now()),
      new.gcash_payment_verified_at, new.gcash_payment_verified_by,
      case when new.gcash_payment_verified_at is not null then 'verified' else 'submitted' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_gcash_payment_proof_history on public.orders;
create trigger capture_gcash_payment_proof_history
after insert or update of gcash_payment_proof_path on public.orders
for each row execute function public.capture_gcash_payment_proof_history();

-- Keep audit history append-only, including for normal authenticated users.
create or replace function public.prevent_financial_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Financial audit records are immutable';
end;
$$;

drop trigger if exists wallet_transactions_immutable on public.wallet_transactions;
create trigger wallet_transactions_immutable before update or delete on public.wallet_transactions
for each row execute function public.prevent_financial_audit_mutation();

drop trigger if exists wallet_audit_events_immutable on public.wallet_audit_events;
create trigger wallet_audit_events_immutable before update or delete on public.wallet_audit_events
for each row execute function public.prevent_financial_audit_mutation();

drop trigger if exists gcash_payment_proof_history_immutable on public.gcash_payment_proof_history;
create trigger gcash_payment_proof_history_immutable before update or delete on public.gcash_payment_proof_history
for each row execute function public.prevent_financial_audit_mutation();

comment on table public.customer_wallets is 'PHP wallet balances; only trusted server-side financial functions may mutate.';
comment on table public.wallet_transactions is 'Immutable, append-only wallet ledger. All balance movements must have a unique idempotency key.';
comment on table public.wallet_top_up_requests is 'Customer-originated top-up requests. Admin can only review existing requests.';
comment on table public.order_refund_cases is 'Tracks direct GCash or SUGOMATE wallet settlement without double-refunding.';
comment on table public.gcash_payment_proof_history is 'Append-only snapshots of each customer-submitted GCash payment proof for admin audit.';
