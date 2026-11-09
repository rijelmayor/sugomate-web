-- Audited cancellation controls for Papalit / Pasugo.
create or replace function public.admin_cancel_service_request(
  p_request_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_requests%rowtype;
  v_reason text := left(trim(coalesce(p_reason,'')),300);
begin
  if v_actor is null or not app_private.has_role(v_actor, 'admin'::public.app_role) then
    raise exception 'Admin access required.';
  end if;
  if char_length(v_reason) < 3 then raise exception 'Enter a reason for this intervention.'; end if;
  select * into v_req from public.service_requests where id=p_request_id for update;
  if not found then raise exception 'Service request not found.'; end if;
  if v_req.status in ('delivered','cancelled') then raise exception 'This request is already closed.'; end if;
  update public.service_requests set status='cancelled', updated_at=now() where id=p_request_id;
  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note,details)
  values(p_request_id,v_actor,'admin','admin_cancelled',v_reason,
    jsonb_build_object('previous_status',v_req.status,'assigned_driver_id',v_req.assigned_driver_id));
end;
$$;

create or replace function public.driver_cancel_service_request(
  p_request_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.service_requests%rowtype;
  v_reason text := left(trim(coalesce(p_reason,'')),300);
begin
  if v_actor is null or not exists (
    select 1 from public.driver_profiles where user_id=v_actor and status='active'
  ) then raise exception 'An approved rider account is required.'; end if;
  if char_length(v_reason) < 3 then raise exception 'Explain why you cannot continue.'; end if;
  select * into v_req from public.service_requests
    where id=p_request_id and assigned_driver_id=v_actor for update;
  if not found then raise exception 'Assigned service request not found.'; end if;
  if v_req.status not in ('assigned','shopping') then
    raise exception 'Riders may cancel only before purchase or item pickup. Contact Admin for help after that stage.';
  end if;
  update public.service_requests set status='cancelled', updated_at=now() where id=p_request_id;
  insert into public.service_request_events(service_request_id,actor_user_id,actor_role,event_type,note,details)
  values(p_request_id,v_actor,'driver','rider_cancelled',v_reason,
    jsonb_build_object('previous_status',v_req.status));
end;
$$;

revoke all on function public.admin_cancel_service_request(uuid,text) from public,anon;
revoke all on function public.driver_cancel_service_request(uuid,text) from public,anon;
grant execute on function public.admin_cancel_service_request(uuid,text) to authenticated;
grant execute on function public.driver_cancel_service_request(uuid,text) to authenticated;
