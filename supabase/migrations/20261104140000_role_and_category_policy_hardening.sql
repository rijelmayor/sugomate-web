-- Harden the role trigger and keep admin category SELECT on a single RLS policy.
revoke all on function public.enforce_exclusive_customer_role() from public, anon, authenticated;

drop policy if exists "Admins manage merchant categories" on public.merchant_categories;
drop policy if exists "Admins insert merchant categories" on public.merchant_categories;
drop policy if exists "Admins update merchant categories" on public.merchant_categories;
drop policy if exists "Admins delete merchant categories" on public.merchant_categories;

create policy "Admins insert merchant categories"
on public.merchant_categories for insert to authenticated
with check (
  exists (select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role)
);

create policy "Admins update merchant categories"
on public.merchant_categories for update to authenticated
using (
  exists (select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role)
)
with check (
  exists (select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role)
);

create policy "Admins delete merchant categories"
on public.merchant_categories for delete to authenticated
using (
  exists (select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role)
);

create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists order_status_history_actor_id_idx on public.order_status_history(actor_id);
create index if not exists orders_branch_id_idx on public.orders(branch_id);
create index if not exists orders_delivery_address_id_idx on public.orders(delivery_address_id);
