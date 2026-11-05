-- Merchant storefront controls: branch hours, temporary closure, accepted payment methods and GCash QR.
-- Testing default: every day 08:00-20:00 Asia/Manila until a merchant saves its own schedule.

alter table public.merchant_branches
  add column if not exists store_hours jsonb not null default
    '{"mon":{"open":"08:00","close":"20:00","closed":false},"tue":{"open":"08:00","close":"20:00","closed":false},"wed":{"open":"08:00","close":"20:00","closed":false},"thu":{"open":"08:00","close":"20:00","closed":false},"fri":{"open":"08:00","close":"20:00","closed":false},"sat":{"open":"08:00","close":"20:00","closed":false},"sun":{"open":"08:00","close":"20:00","closed":false}}'::jsonb,
  add column if not exists is_temporarily_closed boolean not null default false;

alter table public.merchants
  add column if not exists accepted_payment_methods text[] not null default array['cod']::text[],
  add column if not exists gcash_qr_url text;

-- Publicly readable QR assets; writes are restricted to approved merchant members by folder prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-payment-qr', 'merchant-payment-qr', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Merchant members upload their payment QR" on storage.objects;
create policy "Merchant members upload their payment QR"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merchant-payment-qr'
  and exists (
    select 1 from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.user_id = (select auth.uid())
      and m.status = 'approved'
      and (storage.foldername(name))[1] = mm.merchant_id::text
  )
);

drop policy if exists "Merchant members update their payment QR" on storage.objects;
create policy "Merchant members update their payment QR"
on storage.objects for update to authenticated
using (
  bucket_id = 'merchant-payment-qr'
  and exists (
    select 1 from public.merchant_members mm
    where mm.user_id = (select auth.uid())
      and (storage.foldername(name))[1] = mm.merchant_id::text
  )
)
with check (
  bucket_id = 'merchant-payment-qr'
  and exists (
    select 1 from public.merchant_members mm
    where mm.user_id = (select auth.uid())
      and (storage.foldername(name))[1] = mm.merchant_id::text
  )
);

drop policy if exists "Merchant members delete their payment QR" on storage.objects;
create policy "Merchant members delete their payment QR"
on storage.objects for delete to authenticated
using (
  bucket_id = 'merchant-payment-qr'
  and exists (
    select 1 from public.merchant_members mm
    where mm.user_id = (select auth.uid())
      and (storage.foldername(name))[1] = mm.merchant_id::text
  )
);

-- Save settings through a narrowly-scoped RPC because direct merchant UPDATE is intentionally revoked.
create or replace function public.merchant_save_storefront_settings(
  p_merchant_id uuid,
  p_branch_id uuid,
  p_store_hours jsonb,
  p_temporarily_closed boolean,
  p_payment_methods text[],
  p_gcash_qr_url text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day text;
  v_slot jsonb;
begin
  if v_uid is null then raise exception 'You must be signed in.'; end if;
  if not exists (
    select 1 from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = p_merchant_id and mm.user_id = v_uid and m.status = 'approved'
  ) then raise exception 'You do not have permission to manage this store.'; end if;
  if not exists (
    select 1 from public.merchant_branches b
    where b.id = p_branch_id and b.merchant_id = p_merchant_id
  ) then raise exception 'Choose a valid store branch.'; end if;
  if p_payment_methods is null or cardinality(p_payment_methods) = 0
     or exists (select 1 from unnest(p_payment_methods) v where v not in ('cod','gcash')) then
    raise exception 'Select at least one supported payment method.';
  end if;
  if 'gcash' = any(p_payment_methods) and coalesce(p_gcash_qr_url,'') !~ '^https://'
  then raise exception 'Upload a GCash QR image before enabling GCash.'; end if;
  if jsonb_typeof(p_store_hours) <> 'object' then raise exception 'Invalid weekly schedule.'; end if;

  foreach v_day in array array['mon','tue','wed','thu','fri','sat','sun'] loop
    v_slot := p_store_hours -> v_day;
    if v_slot is null or jsonb_typeof(v_slot) <> 'object'
       or coalesce((v_slot->>'closed')::boolean,false) not in (true,false)
       or coalesce(v_slot->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v_slot->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_slot->>'close') <= (v_slot->>'open') then
      raise exception 'Set a valid opening and closing time for each day, or mark the day closed.';
    end if;
  end loop;

  update public.merchant_branches
  set store_hours = p_store_hours,
      is_temporarily_closed = coalesce(p_temporarily_closed,false),
      updated_at = now()
  where id = p_branch_id and merchant_id = p_merchant_id;

  update public.merchants
  set accepted_payment_methods = p_payment_methods,
      gcash_qr_url = nullif(p_gcash_qr_url,''),
      updated_at = now()
  where id = p_merchant_id;
end;
$$;

revoke all on function public.merchant_save_storefront_settings(uuid,uuid,jsonb,boolean,text[],text) from public, anon;
grant execute on function public.merchant_save_storefront_settings(uuid,uuid,jsonb,boolean,text[],text) to authenticated;

-- A single authoritative gate protects checkout even if a customer bypasses the browser UI.
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
  if new.payment_method = 'gcash' and coalesce(v_merchant.gcash_qr_url,'') = '' then
    raise exception 'This store has not configured its GCash QR yet.';
  end if;

  v_local := now() at time zone 'Asia/Manila';
  v_day := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from v_local)::integer + 1];
  v_slot := v_branch.store_hours -> v_day;
  if v_slot is null then
    -- Existing/testing branches use the approved 8 AM-8 PM daily default.
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

drop trigger if exists orders_check_storefront_availability on public.orders;
create trigger orders_check_storefront_availability
before insert on public.orders
for each row execute function app_private.guard_order_storefront_availability();

revoke all on function app_private.guard_order_storefront_availability() from public, anon, authenticated;
