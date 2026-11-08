-- Fix the merchant logo upload policy: validate the uploaded object's
-- first storage folder against the authenticated merchant membership.
-- The previous policy mistakenly inspected merchants.name as if it were
-- a storage path, causing valid logo uploads to be rejected.

drop policy if exists "Merchant members upload their logo" on storage.objects;

create policy "Merchant members upload their logo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'merchant-logos'
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.user_id = (select auth.uid())
      and m.status = 'approved'::public.merchant_status
      and (storage.foldername(objects.name))[1] = mm.merchant_id::text
  )
);
