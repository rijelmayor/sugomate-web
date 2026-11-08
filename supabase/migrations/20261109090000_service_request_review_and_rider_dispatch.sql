-- Papalit / Pasugo Admin review, dispatch and rider lifecycle.
-- Requests remain separate from merchant orders and customers pay the rider directly.

create or replace function public.admin_approve_assign_service_request(
  p_request_id uuid,
  p_driver_user_id uuid,
  p_approved_purchase_budget numeric,
  p_delivery_fee numeric,
  p_service_fee numeric
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_requests%rowtype;
  v_total numeric(12,2);
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if p_approved_purchase_budget is null or p_approved_purchase_budget < 0
     or p_delivery_fee is null or p_delivery_fee < 0
     or p_service_fee is null or p_service_fee < 0 then
    raise exception 'Enter valid non-negative budget and fees.';
  end if;

  select * into v_req from public.service_requests where id=p_request_id for update;
  if not found then raise exception 'Service request not found.'; end if;
  if v_req.status <> 'pending_review' then raise exception 'Only requests awaiting review can be approved.'; end if;
  if v_req.customer_budget is not null and p_approved_purchase_budget > v_req.customer_budget then
    raise exception 'Approved purchase budget cannot exceed the customer budget.';
  end if;
  if not v_req.purchase_required and p_approved_purchase_budget <> 0 then
    raise exception 'Pickup-only requests must have a zero purchase budget.';
  end if;
  if not exists (
    select 1 from public.driver_profiles dp
    where dp.user_id=p_driver_user_id and dp.status='active' and dp.is_available=true
      and (
        dp.municipality_id=v_req.municipality_id
        or exists (
          select 1 from public.rider_locality_authorizations ra
          where ra.rider_user_id=dp.user_id and ra.municipality_id=v_req.municipality_id
            and ra.revoked_at is null and ra.starts_at <= now()
            and (ra.expires_at is null or ra.expires_at > now())
        )
      )
  ) then raise exception 'Choose an online, approved rider authorized for the delivery locality.'; end if;
  if exists (select 1 from public.service_requests sr where sr.assigned_driver_id=p_driver_user_id and sr.status in ('assigned','shopping','purchased','picked_up','in_transit')) then
    raise exception 'This rider already has an active Papalit or Pasugo request.';
  end if;
  v_total := round(p_approved_purchase_budget + p_delivery_fee + p_service_fee, 2);

  update public.service_requests
  set approved_purchase_budget=p_approved_purchase_budget,
      delivery_fee=p_delivery_fee,
      service_fee=p_service_fee,
      quoted_total=v_total,
      assigned_driver_id=p_driver_user_id,
      assigned_at=now(),
      status='assigned',
      updated_at=now()
  where id=p_request_id;

  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note,details)
  values(p_request_id,v_actor,'admin','approved_and_dispatched',
    'Request reviewed, charges confirmed and assigned to a rider.',
    jsonb_build_object('driver_user_id',p_driver_user_id,'approved_purchase_budget',p_approved_purchase_budget,
      'delivery_fee',p_delivery_fee,'service_fee',p_service_fee,'quoted_total',v_total));
end;
$$;

create or replace function public.driver_accept_service_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_requests%rowtype;
  v_next text;
begin
  if v_actor is null or not exists (
    select 1 from public.driver_profiles where user_id=v_actor and status='active'
  ) then raise exception 'An approved rider account is required.'; end if;

  select * into v_req from public.service_requests
  where id=p_request_id and assigned_driver_id=v_actor for update;
  if not found or v_req.status <> 'assigned' then raise exception 'This request is no longer available.'; end if;

  v_next := case when v_req.purchase_required then 'shopping' else 'picked_up' end;
  update public.service_requests
  set status=v_next,
      picked_up_at=case when v_next='picked_up' then now() else picked_up_at end,
      updated_at=now()
  where id=p_request_id;

  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note)
  values(p_request_id,v_actor,'driver','rider_accepted',
    case when v_req.purchase_required then 'Rider accepted and started shopping.' else 'Rider accepted and confirmed item pickup.' end);
end;
$$;

create or replace function public.driver_update_service_request(
  p_request_id uuid,
  p_next_status text,
  p_actual_purchase_amount numeric default null,
  p_payment_method text default null,
  p_gcash_reference text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_requests%rowtype;
  v_collected numeric(12,2);
begin
  if v_actor is null or not exists (
    select 1 from public.driver_profiles where user_id=v_actor and status='active'
  ) then raise exception 'An approved rider account is required.'; end if;

  select * into v_req from public.service_requests
  where id=p_request_id and assigned_driver_id=v_actor for update;
  if not found then raise exception 'Assigned service request not found.'; end if;

  if v_req.status='shopping' and p_next_status='purchased' then
    if p_actual_purchase_amount is null or p_actual_purchase_amount < 0 then
      raise exception 'Enter the actual purchase amount.';
    end if;
    if v_req.approved_purchase_budget is not null and p_actual_purchase_amount > v_req.approved_purchase_budget then
      raise exception 'Actual purchase exceeds the approved budget. Contact Admin before proceeding.';
    end if;
    update public.service_requests set status='purchased',actual_purchase_amount=round(p_actual_purchase_amount,2),
      purchased_at=now(),updated_at=now() where id=p_request_id;
  elsif v_req.status='purchased' and p_next_status='picked_up' then
    update public.service_requests set status='picked_up',picked_up_at=coalesce(picked_up_at,now()),updated_at=now()
    where id=p_request_id;
  elsif v_req.status='picked_up' and p_next_status='in_transit' then
    update public.service_requests set status='in_transit',updated_at=now() where id=p_request_id;
  elsif v_req.status='in_transit' and p_next_status='delivered' then
    if p_payment_method not in ('cash','gcash') then raise exception 'Record whether the customer paid by cash or GCash.'; end if;
    if p_payment_method='gcash' and nullif(trim(coalesce(p_gcash_reference,'')),'') is null then
      raise exception 'Enter the GCash reference number.';
    end if;
    v_collected := round(coalesce(v_req.actual_purchase_amount,0)+coalesce(v_req.delivery_fee,0)+coalesce(v_req.service_fee,0),2);
    update public.service_requests set status='delivered',delivered_at=now(),
      payment_status='paid',payment_method=p_payment_method,amount_collected=v_collected,
      collected_at=now(),collected_by=v_actor,gcash_reference=case when p_payment_method='gcash' then left(trim(p_gcash_reference),120) else null end,
      updated_at=now() where id=p_request_id;
  else
    raise exception 'This request cannot move to the requested stage.';
  end if;

  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note,details)
  values(p_request_id,v_actor,'driver','status_updated',
    'Rider updated service request to '||p_next_status||'.',
    jsonb_build_object('status',p_next_status,'actual_purchase_amount',p_actual_purchase_amount,
      'payment_method',p_payment_method));
end;
$$;

revoke all on function public.admin_approve_assign_service_request(uuid,uuid,numeric,numeric,numeric) from public,anon;
revoke all on function public.driver_accept_service_request(uuid) from public,anon;
revoke all on function public.driver_update_service_request(uuid,text,numeric,text,text) from public,anon;
grant execute on function public.admin_approve_assign_service_request(uuid,uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.driver_accept_service_request(uuid) to authenticated;
grant execute on function public.driver_update_service_request(uuid,text,numeric,text,text) to authenticated;

create index if not exists service_requests_admin_review_idx
  on public.service_requests(status,created_at asc) where status='pending_review';
create index if not exists service_requests_driver_active_idx
  on public.service_requests(assigned_driver_id,status,created_at desc)
  where assigned_driver_id is not null;
