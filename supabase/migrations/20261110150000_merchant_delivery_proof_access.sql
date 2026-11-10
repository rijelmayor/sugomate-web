-- Allow authorized merchant members to view delivery proof for their own completed orders.
-- Customer, assigned-driver, and admin access remains governed by the existing policies.
drop policy if exists "Merchants read delivery proof for their completed orders" on storage.objects;
create policy "Merchants read delivery proof for their completed orders"
on storage.objects for select to authenticated
using (
  bucket_id = 'delivery-proofs'
  and exists (
    select 1
    from public.orders o
    join public.merchant_members mm on mm.merchant_id = o.merchant_id
    where o.delivery_proof_path = storage.objects.name
      and o.status = 'delivered'
      and mm.user_id = (select auth.uid())
  )
);
