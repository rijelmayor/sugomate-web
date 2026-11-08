-- Locality-aware registration, rider dispatch authorization, and route pricing.
-- Existing profiles are intentionally left NULL for Admin remediation; no locality is inferred.

alter table public.profiles
  add column if not exists municipality_id uuid references public.municipalities(id);

alter table public.driver_profiles
  add column if not exists municipality_id uuid references public.municipalities(id);

create table if not exists public.rider_locality_authorizations (
  id uuid primary key default gen_random_uuid(),
  rider_user_id uuid not null references public.driver_profiles(user_id) on delete cascade,
  municipality_id uuid not null references public.municipalities(id),
  authorization_type text not null default 'additional'
    check (authorization_type in ('default','additional')),
  reason text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  authorized_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint rider_locality_expiry_valid check (expires_at is null or expires_at > starts_at)
);

create unique index if not exists rider_locality_one_live_grant
  on public.rider_locality_authorizations(rider_user_id, municipality_id)
  where revoked_at is null;

create index if not exists rider_locality_authorizations_lookup
  on public.rider_locality_authorizations(rider_user_id, municipality_id, expires_at)
  where revoked_at is null;

create table if not exists public.delivery_routes (
  id uuid primary key default gen_random_uuid(),
  origin_municipality_id uuid not null references public.municipalities(id),
  destination_municipality_id uuid not null references public.municipalities(id),
  delivery_fee numeric(12,2) not null check (delivery_fee >= 0),
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint delivery_route_unique_pair unique(origin_municipality_id, destination_municipality_id)
);

create index if not exists delivery_routes_active_lookup
  on public.delivery_routes(origin_municipality_id, destination_municipality_id)
  where is_active = true;

create table if not exists public.rider_locality_authorization_audit (
  id uuid primary key default gen_random_uuid(),
  rider_user_id uuid not null references public.driver_profiles(user_id),
  municipality_id uuid not null references public.municipalities(id),
  action text not null check (action in ('authorized','revoked','expired')),
  authorization_id uuid references public.rider_locality_authorizations(id),
  reason text,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now()
);

alter table public.rider_locality_authorizations enable row level security;
alter table public.delivery_routes enable row level security;
alter table public.rider_locality_authorization_audit enable row level security;

drop policy if exists "Admins manage rider locality authorizations" on public.rider_locality_authorizations;
create policy "Admins manage rider locality authorizations"
  on public.rider_locality_authorizations for all to authenticated
  using ((select app_private.has_role(auth.uid(), 'admin'::public.app_role)))
  with check ((select app_private.has_role(auth.uid(), 'admin'::public.app_role)));

drop policy if exists "Riders view own locality authorizations" on public.rider_locality_authorizations;
create policy "Riders view own locality authorizations"
  on public.rider_locality_authorizations for select to authenticated
  using (rider_user_id = (select auth.uid()));

drop policy if exists "Admins manage delivery routes" on public.delivery_routes;
create policy "Admins manage delivery routes"
  on public.delivery_routes for all to authenticated
  using ((select app_private.has_role(auth.uid(), 'admin'::public.app_role)))
  with check ((select app_private.has_role(auth.uid(), 'admin'::public.app_role)));

drop policy if exists "Authenticated users view active delivery routes" on public.delivery_routes;
create policy "Authenticated users view active delivery routes"
  on public.delivery_routes for select to authenticated
  using (is_active = true);

drop policy if exists "Admins view rider locality audit" on public.rider_locality_authorization_audit;
create policy "Admins view rider locality audit"
  on public.rider_locality_authorization_audit for select to authenticated
  using ((select app_private.has_role(auth.uid(), 'admin'::public.app_role)));

create or replace function app_private.rider_is_authorized_for_locality(
  p_rider_user_id uuid,
  p_municipality_id uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = p_rider_user_id
      and dp.status = 'active'
      and dp.municipality_id = p_municipality_id
  )
  or exists (
    select 1
    from public.rider_locality_authorizations a
    join public.driver_profiles dp on dp.user_id = a.rider_user_id
    join public.municipalities m on m.id = a.municipality_id and m.is_serviceable = true
    where a.rider_user_id = p_rider_user_id
      and a.municipality_id = p_municipality_id
      and a.revoked_at is null
      and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
      and dp.status = 'active'
  );
$$;

revoke all on function app_private.rider_is_authorized_for_locality(uuid,uuid) from public;
grant execute on function app_private.rider_is_authorized_for_locality(uuid,uuid) to authenticated;

create or replace function app_private.enforce_rider_pickup_locality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin uuid;
begin
  if new.driver_user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.driver_user_id is not distinct from old.driver_user_id then
    return new;
  end if;

  select b.municipality_id into v_origin
  from public.merchant_branches b
  where b.id = new.branch_id and b.merchant_id = new.merchant_id and b.is_active = true;

  if v_origin is null then
    raise exception 'The order pickup branch has no active, valid locality.';
  end if;

  if not app_private.rider_is_authorized_for_locality(new.driver_user_id, v_origin) then
    raise exception 'This rider is not authorized to accept orders from the merchant pickup locality.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_order_rider_pickup_locality on public.orders;
create trigger enforce_order_rider_pickup_locality
before insert or update of driver_user_id, branch_id, merchant_id on public.orders
for each row execute function app_private.enforce_rider_pickup_locality();

create or replace function public.admin_authorize_rider_locality(
  p_rider_user_id uuid,
  p_municipality_id uuid,
  p_reason text,
  p_expires_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'A reason is required for additional locality authorization.';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Authorization expiry must be in the future.';
  end if;
  if not exists (select 1 from public.driver_profiles where user_id=p_rider_user_id and status='active') then
    raise exception 'Only an active rider can receive additional locality authorization.';
  end if;
  if not exists (select 1 from public.municipalities where id=p_municipality_id and is_serviceable=true) then
    raise exception 'Choose an active service locality.';
  end if;
  if exists (
    select 1 from public.driver_profiles
    where user_id=p_rider_user_id and municipality_id=p_municipality_id
  ) then
    raise exception 'This is already the rider registered locality.';
  end if;

  update public.rider_locality_authorizations
    set revoked_at=now()
    where rider_user_id=p_rider_user_id and municipality_id=p_municipality_id
      and revoked_at is null;

  insert into public.rider_locality_authorizations(
    rider_user_id, municipality_id, authorization_type, reason, expires_at, authorized_by
  ) values (
    p_rider_user_id, p_municipality_id, 'additional', trim(p_reason), p_expires_at, v_actor
  ) returning id into v_id;

  insert into public.rider_locality_authorization_audit(
    rider_user_id, municipality_id, action, authorization_id, reason, actor_id
  ) values (p_rider_user_id, p_municipality_id, 'authorized', v_id, trim(p_reason), v_actor);

  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'rider_locality_authorized','driver_profiles',p_rider_user_id::text,
    jsonb_build_object('municipality_id',p_municipality_id,'authorization_id',v_id,'expires_at',p_expires_at,'reason',trim(p_reason)));
  return v_id;
end;
$$;

create or replace function public.admin_revoke_rider_locality(
  p_authorization_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.rider_locality_authorizations%rowtype;
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'A reason is required when revoking authorization.';
  end if;
  update public.rider_locality_authorizations
    set revoked_at=now()
    where id=p_authorization_id and revoked_at is null
    returning * into v_row;
  if not found then raise exception 'Active locality authorization not found.'; end if;

  insert into public.rider_locality_authorization_audit(
    rider_user_id,municipality_id,action,authorization_id,reason,actor_id
  ) values(v_row.rider_user_id,v_row.municipality_id,'revoked',v_row.id,trim(p_reason),v_actor);

  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'rider_locality_revoked','driver_profiles',v_row.rider_user_id::text,
    jsonb_build_object('municipality_id',v_row.municipality_id,'authorization_id',v_row.id,'reason',trim(p_reason)));
end;
$$;

revoke all on function public.admin_authorize_rider_locality(uuid,uuid,text,timestamptz) from public;
revoke all on function public.admin_revoke_rider_locality(uuid,text) from public;
grant execute on function public.admin_authorize_rider_locality(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.admin_revoke_rider_locality(uuid,text) to authenticated;

comment on column public.profiles.municipality_id is 'Customer residential municipality; delivery addresses may use any active serviceable municipality.';
comment on column public.driver_profiles.municipality_id is 'Admin-verified rider residential/registered municipality; default pickup locality authorization.';
comment on table public.delivery_routes is 'Admin-approved origin-to-destination delivery fee matrix. Inactive until explicitly configured.';

-- Extend existing checkout RPC without replacing its stock, payment, or financial logic.
do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.place_customer_order(uuid,jsonb,text,text)'::regprocedure) into v_def;
  v_old := '  v_branch uuid;' || E'\n';
  v_new := '  v_branch uuid;' || E'\n' || '  v_origin_municipality uuid;' || E'\n';
  if position(v_old in v_def) = 0 then raise exception 'Could not locate place_customer_order branch declaration; migration stopped safely.'; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := '  select z.base_delivery_fee into v_delivery_fee from public.service_zones z' || E'\n' ||
           '    where z.municipality_id=v_address.municipality_id and z.is_active=true' || E'\n' ||
           '    order by z.created_at asc,z.id asc limit 1;' || E'\n' ||
           '  if v_delivery_fee is null then raise exception ''Delivery fee is not configured for this area yet. Please try again later.''; end if;';
  v_new := '  -- Route fee is resolved after the basket establishes its single merchant branch.';
  if position(v_old in v_def) = 0 then raise exception 'Could not locate legacy delivery fee lookup; migration stopped safely.'; end if;
  v_def := replace(v_def, v_old, v_new);

  v_old := '  if v_count=0 then raise exception ''Your basket is empty.''; end if;';
  v_new := v_old || E'\n' ||
    '  select b.municipality_id into v_origin_municipality from public.merchant_branches b' || E'\n' ||
    '    where b.id=v_branch and b.merchant_id=v_merchant and b.is_active=true;' || E'\n' ||
    '  if v_origin_municipality is null then raise exception ''The selected store branch has no active pickup locality.''; end if;' || E'\n' ||
    '  if not exists(select 1 from public.municipalities m where m.id=v_origin_municipality and m.is_serviceable=true) then raise exception ''The store pickup locality is not currently serviceable.''; end if;' || E'\n' ||
    '  select r.delivery_fee into v_delivery_fee from public.delivery_routes r' || E'\n' ||
    '    where r.origin_municipality_id=v_origin_municipality and r.destination_municipality_id=v_address.municipality_id and r.is_active=true;' || E'\n' ||
    '  if v_delivery_fee is null then raise exception ''This store-to-destination route is not currently approved or priced. Please choose another address or contact support.''; end if;';
  if position(v_old in v_def) = 0 then raise exception 'Could not locate checkout basket completion point; migration stopped safely.'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end;
$migration$;

-- A rider cannot be activated until Admin has verified an active residential locality.
do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.admin_review_driver(uuid,text)'::regprocedure) into v_def;
  v_old := '  if p_status = ''active'' and not exists (' || E'\n' ||
    '    select 1 from public.driver_profiles where user_id = p_user_id and nullif(trim(id_storage_path), '''') is not null' || E'\n' ||
    '  ) then raise exception ''A verified ID document is required before driver activation.''; end if;';
  v_new := '  if p_status = ''active'' and not exists (' || E'\n' ||
    '    select 1 from public.driver_profiles dp join public.municipalities m on m.id=dp.municipality_id and m.is_serviceable=true' || E'\n' ||
    '    where dp.user_id=p_user_id and nullif(trim(dp.id_storage_path), '''') is not null' || E'\n' ||
    '  ) then raise exception ''A verified ID document and an Admin-verified active locality are required before driver activation.''; end if;';
  if position(v_old in v_def) = 0 then raise exception 'Could not locate driver activation validation; migration stopped safely.'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end;
$migration$;


-- Preserve same-municipality ordering during rollout by carrying forward each
-- municipality's existing active service-zone fee. Cross-municipality routes
-- remain disabled until Admin explicitly configures and activates them.
insert into public.delivery_routes(
  origin_municipality_id, destination_municipality_id, delivery_fee,
  is_active, notes, created_at, updated_at
)
select z.municipality_id, z.municipality_id, z.base_delivery_fee,
       true, 'Seeded from the existing active service-zone fee; Admin may revise.',
       now(), now()
from public.service_zones z
join public.municipalities m on m.id=z.municipality_id and m.is_serviceable=true
where z.is_active=true
  and not exists (
    select 1 from public.delivery_routes r
    where r.origin_municipality_id=z.municipality_id
      and r.destination_municipality_id=z.municipality_id
  )
order by z.created_at asc, z.id asc
on conflict (origin_municipality_id, destination_municipality_id) do nothing;

-- Re-check authorization when either the assigned rider OR pickup branch changes.
create or replace function app_private.enforce_rider_pickup_locality()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin uuid;
begin
  if new.driver_user_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.driver_user_id is not distinct from old.driver_user_id
     and new.branch_id is not distinct from old.branch_id
     and new.merchant_id is not distinct from old.merchant_id then
    return new;
  end if;

  select b.municipality_id into v_origin
  from public.merchant_branches b
  where b.id = new.branch_id
    and b.merchant_id = new.merchant_id
    and b.is_active = true;

  if v_origin is null then
    raise exception 'The order pickup branch has no active, valid locality.';
  end if;

  if not app_private.rider_is_authorized_for_locality(new.driver_user_id, v_origin) then
    raise exception 'This rider is not authorized to accept orders from the merchant pickup locality.';
  end if;

  return new;
end;
$$;
