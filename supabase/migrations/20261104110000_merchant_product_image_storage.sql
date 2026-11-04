-- Merchant product image storage. Public reads are intentional for storefront thumbnails;
-- authenticated writes are restricted to approved members of the owning merchant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

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
