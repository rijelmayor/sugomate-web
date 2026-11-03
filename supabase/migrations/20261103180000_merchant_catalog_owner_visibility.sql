-- Merchant catalog access: allow owners to view their own hidden/out-of-stock products.
-- Existing customer-facing visibility policy remains unchanged.
drop policy if exists "Merchant members can view own products" on public.products;
create policy "Merchant members can view own products"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.merchant_members mm
    where mm.user_id = (select auth.uid())
      and mm.merchant_id = products.merchant_id
  )
  or (select app_private.has_role((select auth.uid()), 'admin'::public.app_role))
);
