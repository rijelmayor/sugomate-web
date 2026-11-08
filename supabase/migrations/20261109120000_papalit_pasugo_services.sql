-- Papalit and Pasugo: independent customer service requests, separate from merchant orders.
-- First release supports shopping and item pickup only. Customer pays the assigned rider directly
-- at delivery, in cash or GCash. The rider records collection; SUGOMATE does not collect payment.

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  service_type text not null check (service_type in ('papalit','pasugo')),
  customer_id uuid not null references auth.users(id) on delete restrict,
  assigned_driver_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending_review' check (status in (
    'pending_review','quoted','awaiting_payment','paid','assigned','shopping','purchased',
    'picked_up','in_transit','delivered','cancelled'
  )),
  request_title text not null check (char_length(trim(request_title)) between 2 and 140),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  reference_image_path text,
  purchase_required boolean not null default true,
  pickup_location text,
  pickup_contact_name text,
  pickup_contact_phone text,
  delivery_address_snapshot jsonb not null,
  municipality_id uuid references public.municipalities(id) on delete restrict,
  customer_budget numeric(12,2) check (customer_budget is null or customer_budget >= 0),
  approved_purchase_budget numeric(12,2) check (approved_purchase_budget is null or approved_purchase_budget >= 0),
  actual_purchase_amount numeric(12,2) check (actual_purchase_amount is null or actual_purchase_amount >= 0),
  delivery_fee numeric(12,2) check (delivery_fee is null or delivery_fee >= 0),
  service_fee numeric(12,2) check (service_fee is null or service_fee >= 0),
  quoted_total numeric(12,2) check (quoted_total is null or quoted_total >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  payment_method text check (payment_method in ('cash','gcash')),
  amount_collected numeric(12,2) check (amount_collected is null or amount_collected >= 0),
  collected_at timestamptz,
  collected_by uuid references auth.users(id) on delete set null,
  gcash_reference text,
  rider_advance_amount numeric(12,2) not null default 0 check (rider_advance_amount >= 0),
  rider_reimbursement_amount numeric(12,2) not null default 0 check (rider_reimbursement_amount >= 0),
  receipt_path text,
  pickup_proof_path text,
  delivery_proof_path text,
  customer_approved_at timestamptz,
  customer_approval_snapshot jsonb,
  assigned_at timestamptz,
  purchased_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_customer_created_idx on public.service_requests(customer_id, created_at desc);
create index if not exists service_requests_driver_status_idx on public.service_requests(assigned_driver_id, status, created_at desc);
create index if not exists service_requests_status_created_idx on public.service_requests(status, created_at desc);
create index if not exists service_requests_area_status_idx on public.service_requests(municipality_id, status, created_at desc);

create table if not exists public.service_request_events (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('customer','driver','admin','system')),
  event_type text not null,
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists service_request_events_request_idx on public.service_request_events(service_request_id, created_at);

create table if not exists public.service_request_reimbursements (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests(id) on delete restrict,
  driver_user_id uuid not null references auth.users(id) on delete restrict,
  advance_amount numeric(12,2) not null check (advance_amount >= 0),
  approved_reimbursement numeric(12,2) not null check (approved_reimbursement >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  receipt_path text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_request_reimbursements_driver_idx on public.service_request_reimbursements(driver_user_id, status, created_at desc);

alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;
alter table public.service_request_reimbursements enable row level security;

grant select, insert on public.service_requests to authenticated;
grant select on public.service_request_events to authenticated;
grant select on public.service_request_reimbursements to authenticated;

drop policy if exists "Customers create own service requests" on public.service_requests;
create policy "Customers create own service requests" on public.service_requests
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and assigned_driver_id is null
  and status = 'pending_review'
  and payment_status = 'unpaid'
  and collected_at is null
  and rider_advance_amount = 0
  and rider_reimbursement_amount = 0
  and actual_purchase_amount is null
  and quoted_total is null
  and approved_purchase_budget is null
  and delivery_fee is null
  and service_fee is null
  and payment_method is null
  and amount_collected is null
  and collected_by is null
  and gcash_reference is null
  
  and receipt_path is null
  and pickup_proof_path is null
  and delivery_proof_path is null
  and customer_approved_at is null
  and assigned_at is null
  and purchased_at is null
  and picked_up_at is null
  and delivered_at is null
  and cancelled_at is null
  and cancellation_reason is null
);

drop policy if exists "Customers read own service requests" on public.service_requests;
create policy "Customers read own service requests" on public.service_requests
for select to authenticated
using (customer_id = (select auth.uid()));

drop policy if exists "Assigned drivers read service requests" on public.service_requests;
create policy "Assigned drivers read service requests" on public.service_requests
for select to authenticated
using (assigned_driver_id = (select auth.uid()));

drop policy if exists "Admins manage service requests" on public.service_requests;
create policy "Admins manage service requests" on public.service_requests
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'));

drop policy if exists "Participants read service request events" on public.service_request_events;
create policy "Participants read service request events" on public.service_request_events
for select to authenticated
using (
  exists (
    select 1 from public.service_requests sr
    where sr.id = service_request_id
      and (sr.customer_id = (select auth.uid()) or sr.assigned_driver_id = (select auth.uid()))
  )
  or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin')
);

drop policy if exists "Admins add service request events" on public.service_request_events;
create policy "Admins add service request events" on public.service_request_events
for insert to authenticated
with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'));

drop policy if exists "Assigned drivers add service request events" on public.service_request_events;
create policy "Assigned drivers add service request events" on public.service_request_events
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and actor_role = 'driver'
  and exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.assigned_driver_id = (select auth.uid()))
);

drop policy if exists "Customers add own service request events" on public.service_request_events;
create policy "Customers add own service request events" on public.service_request_events
for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and actor_role = 'customer'
  and exists (select 1 from public.service_requests sr where sr.id = service_request_id and sr.customer_id = (select auth.uid()))
);

drop policy if exists "Drivers read own service reimbursements" on public.service_request_reimbursements;
create policy "Drivers read own service reimbursements" on public.service_request_reimbursements
for select to authenticated
using (driver_user_id = (select auth.uid()));

drop policy if exists "Admins manage service reimbursements" on public.service_request_reimbursements;
create policy "Admins manage service reimbursements" on public.service_request_reimbursements
for all to authenticated
using (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'));

-- Assigned rider records the amount collected directly from the customer at delivery.
create or replace function public.rider_record_service_payment(
  p_request_id uuid,
  p_method text,
  p_amount numeric,
  p_gcash_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare
  v_request public.service_requests%rowtype;
  v_expected numeric(12,2);
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if p_method not in ('cash','gcash') then raise exception 'Choose cash or GCash.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Invalid amount collected.'; end if;
  if p_method = 'gcash' and nullif(trim(p_gcash_reference),'') is null then
    raise exception 'GCash reference is required.';
  end if;

  select * into v_request from public.service_requests
  where id = p_request_id and assigned_driver_id = auth.uid()
  for update;
  if not found then raise exception 'Assigned service request not found.'; end if;
  if v_request.status <> 'in_transit' then raise exception 'Record customer payment at the delivery handover before completing the request.'; end if;
  if v_request.payment_status = 'paid' then raise exception 'Customer payment is already recorded.'; end if;
  if v_request.actual_purchase_amount is null or v_request.delivery_fee is null or v_request.service_fee is null then
    raise exception 'Final purchase and fee amounts must be recorded first.';
  end if;

  v_expected := v_request.actual_purchase_amount + v_request.delivery_fee + v_request.service_fee;
  if round(p_amount,2) <> round(v_expected,2) then
    raise exception 'Collected amount must match the final purchase cost and agreed fees.';
  end if;

  update public.service_requests
  set payment_status = 'paid',
      payment_method = p_method,
      amount_collected = round(p_amount,2),
      collected_at = now(),
      collected_by = auth.uid(),
      gcash_reference = case when p_method = 'gcash' then left(trim(p_gcash_reference),120) else null end,
      updated_at = now()
  where id = p_request_id;

  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note,details)
  values (
    p_request_id, auth.uid(), 'driver', 'customer_payment_collected',
    'Customer paid the assigned rider directly by ' || upper(p_method) || '.',
    jsonb_build_object('method',p_method,'amount',round(p_amount,2),'gcash_reference',case when p_method='gcash' then left(trim(p_gcash_reference),120) else null end)
  );
end;
$;
revoke all on function public.rider_record_service_payment(uuid,text,numeric,text) from public, anon;
grant execute on function public.rider_record_service_payment(uuid,text,numeric,text) to authenticated;

-- Private evidence bucket for reference photos, receipts, pickup proof and delivery proof.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-request-evidence','service-request-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "Service request participants read evidence" on storage.objects;
create policy "Service request participants read evidence" on storage.objects
for select to authenticated
using (
  bucket_id = 'service-request-evidence'
  and (
    exists (
      select 1 from public.service_requests sr
      where sr.id::text = (storage.foldername(name))[1]
        and (sr.customer_id = (select auth.uid()) or sr.assigned_driver_id = (select auth.uid()))
    )
    or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin')
  )
);

drop policy if exists "Customers upload service request references" on storage.objects;
create policy "Customers upload service request references" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'service-request-evidence'
  and exists (
    select 1 from public.service_requests sr
    where sr.id::text = (storage.foldername(name))[1]
      and sr.customer_id = (select auth.uid())
      and sr.status = 'pending_review'
  )
);

drop policy if exists "Assigned drivers upload service request evidence" on storage.objects;
create policy "Assigned drivers upload service request evidence" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'service-request-evidence'
  and exists (
    select 1 from public.service_requests sr
    where sr.id::text = (storage.foldername(name))[1]
      and sr.assigned_driver_id = (select auth.uid())
  )
);


create or replace function public.customer_attach_service_request_reference(p_request_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required.'; end if;
  if p_path !~ ('^' || p_request_id::text || '/reference[.](jpg|png|webp)) then
    raise exception 'Invalid reference image path.';
  end if;
  update public.service_requests
  set reference_image_path = p_path, updated_at = now()
  where id = p_request_id and customer_id = auth.uid() and status = 'pending_review';
  if not found then raise exception 'Request not found or no longer editable.'; end if;
end;
$$;
revoke all on function public.customer_attach_service_request_reference(uuid,text) from public, anon;
grant execute on function public.customer_attach_service_request_reference(uuid,text) to authenticated;
) then
    raise exception 'Invalid reference image path.';
  end if;
  update public.service_requests
  set reference_image_path = p_path, updated_at = now()
  where id = p_request_id and customer_id = auth.uid() and status = 'pending_review';
  if not found then raise exception 'Request not found or no longer editable.'; end if;
end;
$$;
revoke all on function public.customer_attach_service_request_reference(uuid,text) from public, anon;
grant execute on function public.customer_attach_service_request_reference(uuid,text) to authenticated;
