-- Run after 20261105100000_fix_merchant_product_image_storage_policy.sql.
do $$
declare
  v_policy text;
begin
  select with_check into v_policy
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'Approved merchant members upload product images';

  if v_policy is null then
    raise exception 'SEC-010: product image INSERT policy is missing';
  end if;

  if position('storage.foldername(name)' in v_policy) = 0 then
    raise exception 'SEC-010: INSERT policy does not bind merchant_id to the object path';
  end if;

  if position('storage.foldername(m.name)' in v_policy) > 0 then
    raise exception 'SEC-010: INSERT policy still references merchant name as an object path';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Approved merchant members update own product images'
      and position('storage.foldername(name)' in coalesce(qual,'') || coalesce(with_check,'')) > 0
      and position('storage.foldername(m.name)' in coalesce(qual,'') || coalesce(with_check,'')) = 0
  ) then
    raise exception 'SEC-010: UPDATE policy is missing or has an invalid ownership path';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='Approved merchant members delete own product images'
      and position('storage.foldername(name)' in coalesce(qual,'')) > 0
      and position('storage.foldername(m.name)' in coalesce(qual,'')) = 0
  ) then
    raise exception 'SEC-010: DELETE policy is missing or has an invalid ownership path';
  end if;
end;
$$;
