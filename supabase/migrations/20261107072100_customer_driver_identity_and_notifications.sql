-- Let a customer see only the assigned delivery partner's public-facing details for their own order.
-- Never expose ID/license documents or the selfie holding ID. Only a separate public-facing profile photo is eligible.

alter table public.driver_profiles add column if not exists profile_photo_path text;

create or replace function public.customer_order_driver_details(p_order_ids uuid[])
returns table (
  order_id uuid,
  driver_name text,
  driver_phone text,
  vehicle_type text,
  vehicle_plate text,
  profile_photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    coalesce(nullif(trim(p.display_name), ''), 'Delivery partner'),
    nullif(trim(p.phone), ''),
    dp.vehicle_type,
    dp.vehicle_plate,
    dp.profile_photo_path
  from public.orders o
  join public.driver_profiles dp on dp.user_id = o.driver_user_id
  left join public.profiles p on p.id = dp.user_id
  where o.customer_id = auth.uid()
    and o.id = any(coalesce(p_order_ids, array[]::uuid[]))
    and o.driver_user_id is not null
    and o.status in ('accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit','delivered');
$$;

revoke all on function public.customer_order_driver_details(uuid[]) from public, anon;
grant execute on function public.customer_order_driver_details(uuid[]) to authenticated;

create or replace function public.driver_update_profile_photo(p_profile_photo_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Sign in required.'; end if;
  if p_profile_photo_path is null
     or p_profile_photo_path not like v_actor::text || '/profile-%'
     or not exists (
       select 1 from storage.objects so
       where so.bucket_id = 'driver-documents'
         and so.name = p_profile_photo_path
     ) then
    raise exception 'Choose a valid profile photo from your own upload.';
  end if;
  update public.driver_profiles
  set profile_photo_path = p_profile_photo_path,
      updated_at = now()
  where user_id = v_actor and status in ('pending','active');
  if not found then raise exception 'A valid driver application is required.'; end if;
end;
$$;

revoke all on function public.driver_update_profile_photo(text) from public, anon;
grant execute on function public.driver_update_profile_photo(text) to authenticated;

create or replace function public.customer_can_read_assigned_driver_photo(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.driver_profiles dp
    join public.orders o on o.driver_user_id = dp.user_id
    where dp.profile_photo_path = p_object_name
      and o.customer_id = auth.uid()
      and o.status in ('accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit','delivered')
  );
$$;

revoke all on function public.customer_can_read_assigned_driver_photo(text) from public, anon;
grant execute on function public.customer_can_read_assigned_driver_photo(text) to authenticated;

drop policy if exists "Customers read assigned driver profile photo" on storage.objects;
create policy "Customers read assigned driver profile photo"
on storage.objects for select to authenticated
using (
  bucket_id = 'driver-documents'
  and public.customer_can_read_assigned_driver_photo(name)
);
