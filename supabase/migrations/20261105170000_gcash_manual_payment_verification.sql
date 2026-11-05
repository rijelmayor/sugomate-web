-- GCash manual payment details, customer proof upload, and merchant verification.
-- Additive only: existing order placement and fulfillment RPCs remain unchanged.

alter table public.merchants
  add column if not exists gcash_payment_type text not null default 'qr'
    check (gcash_payment_type in ('qr','number')),
  add column if not exists gcash_account_name text,
  add column if not exists gcash_mobile_number text;

alter table public.orders
  add column if not exists gcash_payment_reference text,
  add column if not exists gcash_payment_proof_path text,
  add column if not exists gcash_payment_submitted_at timestamptz,
  add column if not exists gcash_payment_verified_at timestamptz,
  add column if not exists gcash_payment_verified_by uuid references auth.users(id);

create index if not exists orders_gcash_payment_pending_idx
  on public.orders (merchant_id, gcash_payment_submitted_at desc)
  where payment_method = 'gcash' and payment_status = 'pending';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gcash-payment-proofs','gcash-payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Customers upload own GCash payment proof" on storage.objects;
create policy "Customers upload own GCash payment proof"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'gcash-payment-proofs'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.orders o
    where o.id = ((storage.foldername(name))[1])::uuid
      and o.customer_id = (select auth.uid())
      and o.payment_method = 'gcash'
      and o.payment_status in ('pending','failed')
      and o.status not in ('cancelled','rejected')
  )
);

drop policy if exists "Customers and merchant members read GCash payment proof" on storage.objects;
create policy "Customers and merchant members read GCash payment proof"
on storage.objects for select to authenticated
using (
  bucket_id = 'gcash-payment-proofs'
  and exists (
    select 1 from public.orders o
    where o.gcash_payment_proof_path = objects.name
      and (
        o.customer_id = (select auth.uid())
        or exists (
          select 1 from public.merchant_members mm
          where mm.merchant_id = o.merchant_id and mm.user_id = (select auth.uid())
        )
        or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
      )
  )
);

-- Payment settings are saved independently from the existing storefront-hours RPC.
create or replace function public.merchant_save_gcash_payment_settings(
  p_merchant_id uuid,
  p_gcash_enabled boolean,
  p_payment_type text,
  p_account_name text,
  p_mobile_number text,
  p_qr_url text,
  p_accept_cod boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_methods text[] := array[]::text[];
  v_name text := nullif(btrim(coalesce(p_account_name,'')),'');
  v_mobile text := regexp_replace(coalesce(p_mobile_number,''),'[^0-9+]','','g');
  v_qr text := nullif(btrim(coalesce(p_qr_url,'')),'');
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;
  if not exists (
    select 1 from public.merchant_members mm
    join public.merchants m on m.id=mm.merchant_id
    where mm.merchant_id=p_merchant_id and mm.user_id=v_uid and m.status='approved'
  ) then raise exception 'You do not have permission to manage this store.'; end if;

  if coalesce(p_accept_cod,false) then v_methods := array_append(v_methods,'cod'); end if;
  if coalesce(p_gcash_enabled,false) then
    if p_payment_type not in ('number','qr') then raise exception 'Choose a GCash number or QR code payment option.'; end if;
    if p_payment_type='number' then
      if v_name is null or v_mobile !~ '^(09[0-9]{9}|\+639[0-9]{9})$' then
        raise exception 'Enter the GCash account name and a valid Philippine mobile number.'; end if;
    else
      if v_qr !~ '^https://' then raise exception 'Upload your GCash QR code before enabling QR payments.'; end if;
    end if;
    v_methods := array_append(v_methods,'gcash');
  end if;
  if cardinality(v_methods)=0 then raise exception 'Enable at least one payment method.'; end if;

  update public.merchants
  set accepted_payment_methods=v_methods,
      gcash_payment_type=case when p_gcash_enabled then p_payment_type else gcash_payment_type end,
      gcash_account_name=case when p_gcash_enabled and p_payment_type='number' then v_name when p_gcash_enabled then null else gcash_account_name end,
      gcash_mobile_number=case when p_gcash_enabled and p_payment_type='number' then v_mobile when p_gcash_enabled then null else gcash_mobile_number end,
      gcash_qr_url=case when p_gcash_enabled and p_payment_type='qr' then v_qr when p_gcash_enabled then null else gcash_qr_url end,
      updated_at=now()
  where id=p_merchant_id;
end;
$$;

revoke all on function public.merchant_save_gcash_payment_settings(uuid,boolean,text,text,text,text,boolean) from public, anon;
grant execute on function public.merchant_save_gcash_payment_settings(uuid,boolean,text,text,text,text,boolean) to authenticated;

create or replace function public.customer_submit_gcash_payment(
  p_order_id uuid,
  p_transaction_reference text,
  p_proof_path text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_reference text := btrim(coalesce(p_transaction_reference,''));
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;
  if v_reference !~ '^[A-Za-z0-9-]{6,40}$' then raise exception 'Enter a valid GCash transaction reference number.'; end if;
  select * into v_order from public.orders
  where id=p_order_id and customer_id=v_uid for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.payment_method<>'gcash' or v_order.payment_status='paid' then raise exception 'This order is not awaiting GCash payment.'; end if;
  if v_order.status in ('cancelled','rejected','delivered') then raise exception 'This order can no longer accept a payment submission.'; end if;
  if p_proof_path !~ ('^'||p_order_id::text||'/'||v_uid::text||'/[^/]+$') then raise exception 'Invalid payment proof file.'; end if;
  if not exists (
    select 1 from storage.objects so
    where so.bucket_id='gcash-payment-proofs' and so.name=p_proof_path
  ) then raise exception 'Payment proof upload was not found. Please upload it again.'; end if;

  update public.orders
  set gcash_payment_reference=v_reference,
      gcash_payment_proof_path=p_proof_path,
      gcash_payment_submitted_at=now(),
      gcash_payment_verified_at=null,
      gcash_payment_verified_by=null,
      payment_status='pending',
      updated_at=now()
  where id=p_order_id;
end;
$$;

revoke all on function public.customer_submit_gcash_payment(uuid,text,text) from public, anon;
grant execute on function public.customer_submit_gcash_payment(uuid,text,text) to authenticated;

create or replace function public.merchant_confirm_gcash_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;
  select o.* into v_order from public.orders o
  where o.id=p_order_id
    and exists (
      select 1 from public.merchant_members mm
      join public.merchants m on m.id=mm.merchant_id
      where mm.merchant_id=o.merchant_id and mm.user_id=v_uid and m.status='approved'
    )
  for update;
  if not found then raise exception 'Order not found or you do not have permission to manage it.'; end if;
  if v_order.payment_method<>'gcash' or v_order.payment_status<>'pending'
     or v_order.gcash_payment_proof_path is null
     or v_order.gcash_payment_submitted_at is null then
    raise exception 'There is no GCash payment proof awaiting confirmation.';
  end if;
  if v_order.status in ('cancelled','rejected') then raise exception 'This order is no longer active.'; end if;

  update public.orders
  set payment_status='paid',
      gcash_payment_verified_at=now(),
      gcash_payment_verified_by=v_uid,
      updated_at=now()
  where id=p_order_id;
end;
$$;

revoke all on function public.merchant_confirm_gcash_payment(uuid) from public, anon;
grant execute on function public.merchant_confirm_gcash_payment(uuid) to authenticated;

-- Preserve the existing storefront, stock, hours, and service-area checks.
-- Only replace the old QR-only GCash requirement with QR-or-number validation.
create or replace function app_private.guard_order_storefront_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants%rowtype;
  v_branch public.merchant_branches%rowtype;
  v_local timestamp;
  v_day text;
  v_slot jsonb;
  v_clock text;
begin
  select * into v_merchant from public.merchants where id = new.merchant_id;
  select * into v_branch from public.merchant_branches
    where id = new.branch_id and merchant_id = new.merchant_id;

  if not found or v_merchant.id is null or v_merchant.status <> 'approved' or not v_branch.is_active then
    raise exception 'This store is currently unavailable.';
  end if;
  if v_branch.is_temporarily_closed then
    raise exception 'This store is temporarily closed. Please try again later.';
  end if;
  if not (new.payment_method = any(v_merchant.accepted_payment_methods)) then
    raise exception 'This store does not accept the selected payment method.';
  end if;
  if new.payment_method = 'gcash' and not (
    (v_merchant.gcash_payment_type='qr' and coalesce(v_merchant.gcash_qr_url,'') ~ '^https://')
    or
    (v_merchant.gcash_payment_type='number' and coalesce(v_merchant.gcash_account_name,'')<>'' and coalesce(v_merchant.gcash_mobile_number,'')<>'')
  ) then
    raise exception 'This store has not configured its GCash payment details yet.';
  end if;

  v_local := now() at time zone 'Asia/Manila';
  v_day := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from v_local)::integer + 1];
  v_slot := v_branch.store_hours -> v_day;
  if v_slot is null then
    v_slot := jsonb_build_object('open','08:00','close','20:00','closed',false);
  end if;
  if coalesce((v_slot->>'closed')::boolean,false) then
    raise exception 'This store is closed today.';
  end if;
  v_clock := to_char(v_local, 'HH24:MI');
  if v_clock < coalesce(v_slot->>'open','08:00')
     or v_clock >= coalesce(v_slot->>'close','20:00') then
    raise exception 'This store is outside its operating hours.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_order_storefront_availability() from public, anon, authenticated;
