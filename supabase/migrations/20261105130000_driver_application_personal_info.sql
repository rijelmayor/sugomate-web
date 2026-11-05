-- Add personal information fields to driver_profiles so admins can know the rider before approval.
-- Age, address are recommended; ID/license remain optional for application but useful for review.

alter table public.driver_profiles
  add column if not exists age integer,
  add column if not exists address text,
  add column if not exists date_of_birth date;

-- Optional: constrain age to reasonable range
alter table public.driver_profiles
  drop constraint if exists driver_profiles_age_check;
alter table public.driver_profiles
  add constraint driver_profiles_age_check check (age is null or (age >= 18 and age <= 80));

comment on column public.driver_profiles.age is 'Applicant age at time of application (optional but recommended)';
comment on column public.driver_profiles.address is 'Home / base address of the delivery partner (optional but recommended)';

-- Relax the approval requirement: government ID is recommended but not compulsory.
-- Admins can still review based on age, address, and any uploaded documents.
create or replace function public.admin_review_driver(p_user_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_old text; v_id_path text; v_age int; v_address text;
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 if p_status not in ('active','rejected','suspended','pending') then raise exception 'Invalid driver status.'; end if;
 select status::text, id_storage_path, age, address into v_old, v_id_path, v_age, v_address
   from public.driver_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Driver application not found.'; end if;
 -- Soft recommendation: warn via exception only if completely unknown (no age, no address, no ID)
 if p_status='active' and v_old='pending' and v_id_path is null and v_age is null and v_address is null then
   raise exception 'Please ensure the applicant has provided at least age, address, or a government ID before approval.';
 end if;
 update public.driver_profiles set status=p_status::public.account_status,reviewed_at=now(),reviewed_by=v_actor,updated_at=now() where user_id=p_user_id;
 if p_status='active' then
   insert into public.user_roles(user_id,role,assigned_by) values(p_user_id,'driver'::public.app_role,v_actor) on conflict(user_id,role) do nothing;
 end if;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'driver_status_changed','driver_profiles',p_user_id::text,jsonb_build_object('from',v_old,'to',p_status));
end; $$;

-- Optional extra fields for merchant applications (revision).
alter table public.merchants
  add column if not exists address text,
  add column if not exists contact_phone text,
  add column if not exists description text;
