-- Driver applications must include identification documents.
-- Files live in a PRIVATE bucket; only the applicant (own folder) and admins can read them.
-- Apply before deploying the new /driver/apply page.

alter table public.driver_profiles
  add column if not exists selfie_storage_path text;

-- Applicants may attach / replace their own document paths (status and review fields stay locked).
grant update (vehicle_type, vehicle_plate, license_storage_path, id_storage_path, selfie_storage_path)
  on table public.driver_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-documents', 'driver-documents', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Applicants upload own driver documents" on storage.objects;
create policy "Applicants upload own driver documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Applicants and admins read driver documents" on storage.objects;
create policy "Applicants and admins read driver documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
  )
);

drop policy if exists "Applicants delete own driver documents" on storage.objects;
create policy "Applicants delete own driver documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Admins cannot approve a pending application that has no government ID on file.
create or replace function public.admin_review_driver(p_user_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare v_actor uuid:=auth.uid(); v_old text; v_id_path text;
begin
 if v_actor is null or not app_private.has_role(v_actor,'admin'::public.app_role) then raise exception 'Admin access required.'; end if;
 if p_status not in ('active','rejected','suspended','pending') then raise exception 'Invalid driver status.'; end if;
 select status::text, id_storage_path into v_old, v_id_path from public.driver_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Driver application not found.'; end if;
 if p_status='active' and v_old='pending' and v_id_path is null then raise exception 'A government ID must be uploaded before approval.'; end if;
 update public.driver_profiles set status=p_status::public.account_status,reviewed_at=now(),reviewed_by=v_actor,updated_at=now() where user_id=p_user_id;
 if p_status='active' then
   insert into public.user_roles(user_id,role,assigned_by) values(p_user_id,'driver'::public.app_role,v_actor) on conflict(user_id,role) do nothing;
 end if;
 insert into public.audit_logs(actor_id,action,entity_table,entity_id,details)
 values(v_actor,'driver_status_changed','driver_profiles',p_user_id::text,jsonb_build_object('from',v_old,'to',p_status));
end; $$;
