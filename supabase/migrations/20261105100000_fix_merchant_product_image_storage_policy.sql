-- Correct merchant product-image ownership checks.
-- The live policies were comparing merchant_id to foldername(merchants.name),
-- which is unrelated to the Storage object path and rejects valid uploads.
-- The object path is: {merchant_id}/{auth.uid()}/{random-file}.webp

drop policy if exists "Approved merchant members upload product images" on storage.objects;
create policy "Approved merchant members upload product images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = ((storage.foldername(name))[1])::uuid
      and mm.user_id = (select auth.uid())
      and m.status = 'approved'
  )
);

drop policy if exists "Approved merchant members update own product images" on storage.objects;
create policy "Approved merchant members update own product images"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = ((storage.foldername(name))[1])::uuid
      and mm.user_id = (select auth.uid())
      and m.status = 'approved'
  )
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = ((storage.foldername(name))[1])::uuid
      and mm.user_id = (select auth.uid())
      and m.status = 'approved'
  )
);

drop policy if exists "Approved merchant members delete own product images" on storage.objects;
create policy "Approved merchant members delete own product images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = ((storage.foldername(name))[1])::uuid
      and mm.user_id = (select auth.uid())
      and m.status = 'approved'
  )
);
