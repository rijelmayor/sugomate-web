-- Papalit and Pasugo: independent customer service requests, separate from merchant orders.
-- First release supports shopping and item pickup only. Customer payment is confirmed by Admin
-- after the platform payment instructions are configured; no merchant checkout/COD is reused.

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
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','proof_submitted','paid','refunded','partially_refunded')),
  payment_reference text,
  payment_proof_path text,
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid references auth.users(id) on delete set null,
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
  and payment_confirmed_at is null
  and rider_advance_amount = 0
  and rider_reimbursement_amount = 0
  and actual_purchase_amount is null
  and quoted_total is null
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
