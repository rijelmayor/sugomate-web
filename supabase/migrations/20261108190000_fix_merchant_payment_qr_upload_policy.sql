-- Correct merchant GCash QR upload authorization.
-- The prior policy accidentally checked storage.foldername(merchants.name)
-- instead of the uploaded object's path, rejecting every legitimate upload.

drop policy if exists "Merchant members upload their payment QR" on storage.objects;

create policy "Merchant members upload their payment QR"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'merchant-payment-qr'
  and exists (
    select 1
    from public.merchant_members mm
    join public.merchants m on m.id = mm.merchant_id
    where mm.user_id = (select auth.uid())
      and m.status = 'approved'::public.merchant_status
      and (storage.foldername(objects.name))[1] = mm.merchant_id::text
  )
);
