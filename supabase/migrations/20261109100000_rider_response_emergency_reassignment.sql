-- SUGOMATE rider response timers and emergency reassignment.
-- Admin-configurable response window; all portals use the same persisted deadline.

create table if not exists public.rider_dispatch_settings (
  id boolean primary key default true check (id = true),
  response_window_minutes integer not null default 7 check (response_window_minutes between 1 and 30),
  reminder_after_minutes integer not null default 3 check (reminder_after_minutes between 1 and 29),
  warning_after_minutes integer not null default 5 check (warning_after_minutes between 1 and 29),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.rider_dispatch_settings(id) values(true) on conflict(id) do nothing;
alter table public.rider_dispatch_settings enable row level security;
drop policy if exists "Authenticated users read rider dispatch settings" on public.rider_dispatch_settings;
create policy "Authenticated users read rider dispatch settings"
on public.rider_dispatch_settings for select to authenticated using (true);
revoke insert, update, delete on public.rider_dispatch_settings from anon, authenticated;
grant select on public.rider_dispatch_settings to authenticated;

alter table public.orders
  add column if not exists driver_response_deadline_at timestamptz,
  add column if not exists driver_response_started_at timestamptz,
  add column if not exists rider_reassignment_count integer not null default 0;

create index if not exists orders_driver_response_deadline_idx
  on public.orders(driver_response_deadline_at)
  where status='assigned' and driver_assignment_status='offered';

create table if not exists public.order_delivery_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  from_driver_user_id uuid references auth.users(id),
  to_driver_user_id uuid not null references auth.users(id),
  initiated_by uuid not null references auth.users(id),
  reason text not null,
  custody_location text,
  handoff_type text not null check (handoff_type in ('pre_pickup_release','admin_emergency_override')),
  created_at timestamptz not null default now()
);
alter table public.order_delivery_handoffs enable row level security;
revoke all on public.order_delivery_handoffs from anon, authenticated;

create or replace function public.admin_save_rider_response_settings(
  p_response_window_minutes integer,
  p_reminder_after_minutes integer default 3,
  p_warning_after_minutes integer default 5
) returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
  if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if p_response_window_minutes not between 1 and 30
     or p_reminder_after_minutes not between 1 and p_response_window_minutes - 1
     or p_warning_after_minutes not between p_reminder_after_minutes and p_response_window_minutes - 1 then
    raise exception 'Choose a response window from 2–30 minutes and valid reminder/warning intervals.';
  end if;
  update public.rider_dispatch_settings
  set response_window_minutes=p_response_window_minutes,
      reminder_after_minutes=p_reminder_after_minutes,
      warning_after_minutes=p_warning_after_minutes,
      updated_at=now(),updated_by=v_actor
  where id=true;
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'rider_response_settings_updated','rider_dispatch_settings','true',
    jsonb_build_object('response_window_minutes',p_response_window_minutes,
      'reminder_after_minutes',p_reminder_after_minutes,'warning_after_minutes',p_warning_after_minutes));
end;
$$;

-- Dispatch offers use a deadline captured at assignment time. Later setting changes
-- never rewrite a live order's deadline.
create or replace function public.admin_assign_order_to_driver(p_order_id uuid,p_driver_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_order public.orders%rowtype;
  v_minutes integer;
begin
  if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status<>'ready_for_pickup' or v_order.driver_user_id is not null then
    raise exception 'Only unassigned orders ready for pickup can be dispatched.';
  end if;
  if not exists(select 1 from public.driver_profiles dp
    where dp.user_id=p_driver_user_id and dp.status='active' and dp.is_available=true) then
    raise exception 'Choose an approved driver who is currently online.';
  end if;
  select response_window_minutes into v_minutes from public.rider_dispatch_settings where id=true;
  v_minutes:=coalesce(v_minutes,7);
  update public.orders
  set driver_user_id=p_driver_user_id,driver_assignment_status='offered',
      status='assigned',assigned_at=now(),driver_response_started_at=now(),
      driver_response_deadline_at=now()+make_interval(mins=>v_minutes),
      rider_assignment_expired_at=null,updated_at=now()
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,'assigned',v_actor,
    'Dispatch offer sent; rider response window: '||v_minutes||' minutes');
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'driver_assigned','orders',p_order_id::text,
    jsonb_build_object('driver_user_id',p_driver_user_id,'order_number',v_order.order_number,
      'response_window_minutes',v_minutes));
end;
$$;

-- Expiration is idempotent and safe when called by any authenticated portal.
create or replace function public.expire_rider_response_timeouts()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  with expired as (
    update public.orders
    set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
        assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
        rider_assignment_expired_at=now(),rider_reassignment_count=rider_reassignment_count+1,
        updated_at=now()
    where status='assigned' and driver_assignment_status='offered'
      and driver_response_deadline_at is not null and driver_response_deadline_at<=now()
    returning id,order_number
  ), history as (
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    select id,'assigned','ready_for_pickup',auth.uid(),
      'Rider response window expired; order automatically returned to dispatch queue'
    from expired
  )
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  select auth.uid(),'rider_response_timeout','orders',id::text,
    jsonb_build_object('order_number',order_number,'automatic_reassignment',true)
  from expired;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

create or replace function public.merchant_release_unresponsive_rider(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype; v_reason text:=left(trim(coalesce(p_reason,'')),300);
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if length(v_reason)<3 then raise exception 'Provide a reason for releasing this rider.'; end if;
  select o.* into v_order from public.orders o
  where o.id=p_order_id
    and exists(select 1 from public.merchant_members mm where mm.merchant_id=o.merchant_id and mm.user_id=v_actor)
    and exists(select 1 from public.merchants m where m.id=o.merchant_id and m.status='approved')
  for update;
  if not found then raise exception 'Order not found or merchant access denied.'; end if;
  if v_order.status not in ('assigned','accepted','preparing','ready_for_pickup')
     or v_order.picked_up_at is not null
     or v_order.driver_user_id is null then
    raise exception 'Only an assigned order that has not been picked up can be returned to the queue.';
  end if;
  update public.orders
  set driver_user_id=null,driver_assignment_status=null,
      status=case when v_order.status='accepted' then 'accepted' else 'ready_for_pickup' end,
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
      rider_reassignment_count=rider_reassignment_count+1,updated_at=now()
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,
    case when v_order.status='accepted' then 'accepted' else 'ready_for_pickup' end,
    v_actor,'Merchant released rider before pickup: '||v_reason);
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'merchant_released_rider','orders',p_order_id::text,
    jsonb_build_object('previous_driver_user_id',v_order.driver_user_id,'reason',v_reason,
      'stock_reservations_preserved',true,'picked_up',false));
end;
$$;

create or replace function public.driver_report_emergency_before_pickup(p_order_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype; v_reason text:=left(trim(coalesce(p_reason,'')),300);
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if length(v_reason)<3 then raise exception 'Describe the emergency briefly.'; end if;
  select * into v_order from public.orders where id=p_order_id and driver_user_id=v_actor for update;
  if not found or v_order.picked_up_at is not null or v_order.status not in ('assigned','accepted','preparing','ready_for_pickup') then
    raise exception 'This delivery cannot be released through the pre-pickup emergency flow.';
  end if;
  update public.orders
  set driver_user_id=null,driver_assignment_status=null,
      status=case when v_order.status='accepted' then 'accepted' else 'ready_for_pickup' end,
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
      rider_reassignment_count=rider_reassignment_count+1,updated_at=now()
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,
    case when v_order.status='accepted' then 'accepted' else 'ready_for_pickup' end,
    v_actor,'Rider reported emergency before pickup: '||v_reason);
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'driver_emergency_release','orders',p_order_id::text,
    jsonb_build_object('reason',v_reason,'picked_up',false));
end;
$$;

-- After pickup, only Admin can reassign. The handoff record preserves custody history;
-- stock is already committed and is never reserved or deducted a second time.
create or replace function public.admin_emergency_reassign_picked_up_order(
  p_order_id uuid,p_new_driver_user_id uuid,p_reason text,p_custody_location text default null
) returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
  v_reason text:=left(trim(coalesce(p_reason,'')),500);
  v_location text:=left(trim(coalesce(p_custody_location,'')),300);
begin
  if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if length(v_reason)<5 then raise exception 'A detailed emergency reason is required.'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.status not in ('picked_up','in_transit') or v_order.picked_up_at is null then
    raise exception 'Only an order already picked up can use emergency transfer.';
  end if;
  if not exists(select 1 from public.driver_profiles dp
    where dp.user_id=p_new_driver_user_id and dp.status='active' and dp.is_available=true) then
    raise exception 'Choose an approved, online replacement rider.';
  end if;
  if exists(select 1 from public.orders o where o.driver_user_id=p_new_driver_user_id
    and o.status in ('assigned','picked_up','in_transit')) then
    raise exception 'The replacement rider already has an active delivery.';
  end if;
  insert into public.order_delivery_handoffs(order_id,from_driver_user_id,to_driver_user_id,
    initiated_by,reason,custody_location,handoff_type)
  values(p_order_id,v_order.driver_user_id,p_new_driver_user_id,v_actor,v_reason,
    nullif(v_location,''),'admin_emergency_override');
  update public.orders set driver_user_id=p_new_driver_user_id,
    driver_assignment_status='accepted',driver_response_deadline_at=null,
    driver_response_started_at=null,updated_at=now()
  where id=p_order_id;
  insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
  values(p_order_id,v_order.status,v_order.status,v_actor,
    'Admin emergency reassignment to replacement rider. Custody/location: '||
    coalesce(nullif(v_location,''),'Not supplied')||'. Reason: '||v_reason);
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  values(v_actor,'admin_emergency_rider_reassignment','orders',p_order_id::text,
    jsonb_build_object('from_driver_user_id',v_order.driver_user_id,
      'to_driver_user_id',p_new_driver_user_id,'reason',v_reason,
      'custody_location',nullif(v_location,''),'stock_deduction_repeated',false));
end;
$$;

revoke all on function public.admin_save_rider_response_settings(integer,integer,integer) from public,anon;
revoke all on function public.expire_rider_response_timeouts() from public,anon;
revoke all on function public.merchant_release_unresponsive_rider(uuid,text) from public,anon;
revoke all on function public.driver_report_emergency_before_pickup(uuid,text) from public,anon;
revoke all on function public.admin_emergency_reassign_picked_up_order(uuid,uuid,text,text) from public,anon;
grant execute on function public.admin_save_rider_response_settings(integer,integer,integer) to authenticated;
grant execute on function public.expire_rider_response_timeouts() to authenticated;
grant execute on function public.merchant_release_unresponsive_rider(uuid,text) to authenticated;
grant execute on function public.driver_report_emergency_before_pickup(uuid,text) to authenticated;
grant execute on function public.admin_emergency_reassign_picked_up_order(uuid,uuid,text,text) to authenticated;


-- A rider who claims an accepted order must also confirm departure within the same
-- Admin-configured response window.
create or replace function public.set_claimed_rider_response_deadline()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_minutes integer;
begin
  if new.status='accepted' and new.driver_user_id is not null
     and new.driver_assignment_status='claimed'
     and (tg_op='INSERT' or old.driver_user_id is distinct from new.driver_user_id
       or old.driver_assignment_status is distinct from new.driver_assignment_status
       or new.driver_response_deadline_at is null) then
    select response_window_minutes into v_minutes from public.rider_dispatch_settings where id=true;
    new.driver_response_started_at:=now();
    new.driver_response_deadline_at:=now()+make_interval(mins=>coalesce(v_minutes,7));
  end if;
  if tg_op='UPDATE' and old.driver_assignment_status='claimed'
     and new.driver_assignment_status='en_route'
     and old.driver_response_deadline_at is not null
     and old.driver_response_deadline_at<=now() then
    raise exception 'The rider response window expired. The order is being returned to the queue; refresh the portal.';
  end if;
  return new;
end;
$$;
drop trigger if exists set_claimed_rider_response_deadline on public.orders;
create trigger set_claimed_rider_response_deadline
before insert or update of driver_user_id,driver_assignment_status,driver_response_deadline_at
on public.orders for each row execute function public.set_claimed_rider_response_deadline();

-- Extend timeout processing to the global claim -> "I'm on my way" commitment too.
create or replace function public.expire_rider_response_timeouts()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  with expired as (
    update public.orders
    set driver_user_id=null,driver_assignment_status=null,
        status=case when status='assigned' then 'ready_for_pickup' else 'accepted' end,
        assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
        rider_assignment_expired_at=now(),rider_reassignment_count=rider_reassignment_count+1,
        updated_at=now()
    where ((status='assigned' and driver_assignment_status='offered')
        or (status='accepted' and driver_assignment_status='claimed'))
      and driver_response_deadline_at is not null and driver_response_deadline_at<=now()
    returning id,order_number,status
  ), history as (
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    select id,case when status='ready_for_pickup' then 'assigned' else 'accepted' end,
      status,auth.uid(),'Rider response window expired; assignment released automatically'
    from expired
  )
  insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
  select auth.uid(),'rider_response_timeout','orders',id::text,
    jsonb_build_object('order_number',order_number,'returned_status',status)
  from expired;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.set_claimed_rider_response_deadline() from public,anon,authenticated;


-- Enforce the deadline at the database boundary, not only in the countdown UI.
create or replace function public.driver_respond_to_assignment(p_order_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists(select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders
  where id=p_order_id and driver_user_id=v_actor
  for update;
  if not found or v_order.status<>'assigned' or v_order.driver_assignment_status<>'offered' then
    raise exception 'This delivery offer is no longer available.';
  end if;
  if v_order.driver_response_deadline_at is not null and v_order.driver_response_deadline_at<=now() then
    update public.orders set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
      rider_assignment_expired_at=now(),rider_reassignment_count=rider_reassignment_count+1,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','ready_for_pickup',v_actor,'Rider response arrived after the deadline; order returned to dispatch queue');
    insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
    values(v_actor,'late_rider_response','orders',p_order_id::text,
      jsonb_build_object('deadline',v_order.driver_response_deadline_at,'response_rejected',true));
    return;
  end if;
  if p_accept then
    update public.orders set driver_assignment_status='accepted',updated_at=now() where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','assigned',v_actor,'Delivery partner accepted assignment within response window');
  else
    update public.orders set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','ready_for_pickup',v_actor,'Delivery partner declined assignment; returned to dispatch queue');
  end if;
end;
$$;
revoke all on function public.driver_respond_to_assignment(uuid,boolean) from public,anon;
grant execute on function public.driver_respond_to_assignment(uuid,boolean) to authenticated;


-- Stop the response clock as soon as the rider has fulfilled the response.
create or replace function public.set_claimed_rider_response_deadline()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_minutes integer;
begin
  if new.status='accepted' and new.driver_user_id is not null
     and new.driver_assignment_status='claimed'
     and (tg_op='INSERT' or old.driver_user_id is distinct from new.driver_user_id
       or old.driver_assignment_status is distinct from new.driver_assignment_status
       or new.driver_response_deadline_at is null) then
    select response_window_minutes into v_minutes from public.rider_dispatch_settings where id=true;
    new.driver_response_started_at:=now();
    new.driver_response_deadline_at:=now()+make_interval(mins=>coalesce(v_minutes,7));
  end if;
  if tg_op='UPDATE' and old.driver_assignment_status='claimed'
     and new.driver_assignment_status='en_route' then
    if old.driver_response_deadline_at is not null and old.driver_response_deadline_at<=now() then
      raise exception 'The rider response window expired. Refresh the portal to return the order to the queue.';
    end if;
    new.driver_response_deadline_at:=null;
    new.driver_response_started_at:=null;
  end if;
  return new;
end;
$$;

create or replace function public.driver_respond_to_assignment(p_order_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_order public.orders%rowtype;
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if not exists(select 1 from public.driver_profiles where user_id=v_actor and status='active') then
    raise exception 'An approved delivery partner account is required.';
  end if;
  select * into v_order from public.orders where id=p_order_id and driver_user_id=v_actor for update;
  if not found or v_order.status<>'assigned' or v_order.driver_assignment_status<>'offered' then
    raise exception 'This delivery offer is no longer available.';
  end if;
  if v_order.driver_response_deadline_at is not null and v_order.driver_response_deadline_at<=now() then
    update public.orders set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,
      rider_assignment_expired_at=now(),rider_reassignment_count=rider_reassignment_count+1,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','ready_for_pickup',v_actor,'Rider response arrived after deadline; returned to dispatch queue');
    insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
    values(v_actor,'late_rider_response','orders',p_order_id::text,
      jsonb_build_object('deadline',v_order.driver_response_deadline_at,'response_rejected',true));
    return;
  end if;
  if p_accept then
    update public.orders set driver_assignment_status='accepted',
      driver_response_deadline_at=null,driver_response_started_at=null,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','assigned',v_actor,'Delivery partner accepted assignment within response window');
  else
    update public.orders set driver_user_id=null,driver_assignment_status=null,status='ready_for_pickup',
      assigned_at=null,driver_response_deadline_at=null,driver_response_started_at=null,updated_at=now()
    where id=p_order_id;
    insert into public.order_status_history(order_id,from_status,to_status,actor_id,note)
    values(p_order_id,'assigned','ready_for_pickup',v_actor,'Delivery partner declined assignment; returned to dispatch queue');
  end if;
end;
$$;
revoke all on function public.driver_respond_to_assignment(uuid,boolean) from public,anon;
grant execute on function public.driver_respond_to_assignment(uuid,boolean) to authenticated;
