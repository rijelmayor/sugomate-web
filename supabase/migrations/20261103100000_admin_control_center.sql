-- SUGOMATE Admin Control Center: privileged workflows and protection against self-approval.
-- Apply only after the repository migration is merged.

-- Prevent owners/applicants from changing their own review status or reviewer metadata.
revoke update on table public.merchants from authenticated;
grant update (name, slug, description, logo_url) on table public.merchants to authenticated;

revoke update on table public.driver_profiles from authenticated;
grant update (vehicle_type, vehicle_plate, license_storage_path, id_storage_path) on table public.driver_profiles to authenticated;

-- Admins may manage service-zone rows through RLS; customer-facing users only see active zones.
drop policy if exists "admin_manage_service_zones" on public.service_zones;
create policy "admin_manage_service_zones"
on public.service_zones for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::public.app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::public.app_role)));

create or replace function public.admin_review_merchant(p_merchant_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_old text;
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 if p_status not in ('approved','rejected','suspended') then raise exception 'Invalid merchant status.'; end if;
 select status::text into v_old from public.merchants where id=p_merchant_id for update;
 if not found then raise exception 'Merchant not found.'; end if;
 update public.merchants set status=p_status::public.merchant_status,reviewed_at=now(),reviewed_by=v_actor,updated_at=now() where id=p_merchant_id;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'merchant_status_changed','merchants',p_merchant_id::text,jsonb_build_object('from',v_old,'to',p_status));
end; $$;

create or replace function public.admin_review_driver(p_user_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_old text;
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 if p_status not in ('active','rejected','suspended','pending') then raise exception 'Invalid driver status.'; end if;
 select status::text into v_old from public.driver_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Driver application not found.'; end if;
 update public.driver_profiles set status=p_status::public.account_status,reviewed_at=now(),reviewed_by=v_actor,updated_at=now() where user_id=p_user_id;
 if p_status='active' then
   insert into public.user_roles(user_id,role,assigned_by) values(p_user_id,'driver'::public.app_role,v_actor) on conflict(user_id,role) do nothing;
 end if;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'driver_status_changed','driver_profiles',p_user_id::text,jsonb_build_object('from',v_old,'to',p_status));
end; $$;

create or replace function public.admin_save_service_zone(
 p_zone_id uuid,p_municipality_id uuid,p_name text,p_base_delivery_fee numeric,p_is_active boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_id uuid;
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 if p_name is null or length(trim(p_name))<2 or p_base_delivery_fee is null or p_base_delivery_fee<0 or p_base_delivery_fee>10000 then raise exception 'Check the zone name and delivery fee.'; end if;
 if not exists(select 1 from public.municipalities where id=p_municipality_id) then raise exception 'Municipality not found.'; end if;
 if p_zone_id is null then
   insert into public.service_zones(municipality_id,name,base_delivery_fee,is_active) values(p_municipality_id,trim(p_name),p_base_delivery_fee,coalesce(p_is_active,false)) returning id into v_id;
 else
   update public.service_zones set municipality_id=p_municipality_id,name=trim(p_name),base_delivery_fee=p_base_delivery_fee,is_active=coalesce(p_is_active,false)
   where id=p_zone_id returning id into v_id;
   if v_id is null then raise exception 'Service zone not found.'; end if;
 end if;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'service_zone_saved','service_zones',v_id::text,jsonb_build_object('municipality_id',p_municipality_id,'name',trim(p_name),'base_delivery_fee',p_base_delivery_fee,'is_active',coalesce(p_is_active,false)));
 return v_id;
end; $$;

create or replace function public.admin_set_municipality_serviceable(p_municipality_id uuid,p_is_serviceable boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 update public.municipalities set is_serviceable=p_is_serviceable where id=p_municipality_id;
 if not found then raise exception 'Municipality not found.'; end if;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'municipality_serviceability_changed','municipalities',p_municipality_id::text,jsonb_build_object('is_serviceable',p_is_serviceable));
end; $$;

revoke all on function public.admin_review_merchant(uuid,text) from public,anon;
revoke all on function public.admin_review_driver(uuid,text) from public,anon;
revoke all on function public.admin_save_service_zone(uuid,uuid,text,numeric,boolean) from public,anon;
revoke all on function public.admin_set_municipality_serviceable(uuid,boolean) from public,anon;
grant execute on function public.admin_review_merchant(uuid,text) to authenticated;
grant execute on function public.admin_review_driver(uuid,text) to authenticated;
grant execute on function public.admin_save_service_zone(uuid,uuid,text,numeric,boolean) to authenticated;
grant execute on function public.admin_set_municipality_serviceable(uuid,boolean) to authenticated;
