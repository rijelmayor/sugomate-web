-- Let a customer see only the assigned delivery partner's public-facing details for their own order.
-- Never expose ID/license documents; only the driver's application selfie is eligible for this read path.

create or replace function public.customer_order_driver_details(p_order_ids uuid[])
returns table (
  order_id uuid,
  driver_name text,
  driver_phone text,
  vehicle_type text,
  vehicle_plate text,
  selfie_storage_path text
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
    dp.selfie_storage_path
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

drop policy if exists "Customers read assigned driver profile photo" on storage.objects;
create policy "Customers read assigned driver profile photo"
on storage.objects for select to authenticated
using (
  bucket_id = 'driver-documents'
  and exists (
    select 1
    from public.driver_profiles dp
    join public.orders o on o.driver_user_id = dp.user_id
    where dp.selfie_storage_path = storage.objects.name
      and o.customer_id = (select auth.uid())
      and o.status in ('accepted','preparing','ready_for_pickup','assigned','picked_up','in_transit','delivered')
  )
);
