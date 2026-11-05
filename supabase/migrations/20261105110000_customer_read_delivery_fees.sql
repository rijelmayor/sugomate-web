-- Lets signed-in customers see the delivery fee for active service zones before
-- placing an order. Fees are not sensitive; checkout still verifies them server-side.
-- Optional: if this is not applied, the app falls back to "Calculated at checkout".
drop policy if exists "customers_read_active_service_zones" on public.service_zones;
create policy "customers_read_active_service_zones"
on public.service_zones for select to authenticated
using (is_active = true);
