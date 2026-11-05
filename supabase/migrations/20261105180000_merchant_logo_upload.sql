-- Merchant store logos: public read, writes limited to approved members of the owning merchant (folder = merchant id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-logos', 'merchant-logos', true, 1048576, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp'];

drop policy if exists "Merchant members upload their logo" on storage.objects;
create policy "Merchant members upload their logo" on storage.objects for insert to authenticated
with check (bucket_id = 'merchant-logos' and exists (
  select 1 from public.merchant_members mm join public.merchants m on m.id = mm.merchant_id
  where mm.user_id = (select auth.uid()) and m.status = 'approved' and (storage.foldername(name))[1] = mm.merchant_id::text));

drop policy if exists "Merchant members delete their logo" on storage.objects;
create policy "Merchant members delete their logo" on storage.objects for delete to authenticated
using (bucket_id = 'merchant-logos' and exists (
  select 1 from public.merchant_members mm
  where mm.user_id = (select auth.uid()) and (storage.foldername(name))[1] = mm.merchant_id::text));

create or replace function public.merchant_set_logo(p_merchant_id uuid, p_logo_url text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.merchant_members mm join public.merchants m on m.id = mm.merchant_id
    where mm.merchant_id = p_merchant_id and mm.user_id = (select auth.uid()) and m.status = 'approved') then
    raise exception 'Not allowed to change this store logo.';
  end if;
  if p_logo_url is not null and p_logo_url !~ '^https://' then raise exception 'Invalid logo URL.'; end if;
  update public.merchants set logo_url = p_logo_url where id = p_merchant_id;
end;
$$;
revoke all on function public.merchant_set_logo(uuid, text) from public, anon;
grant execute on function public.merchant_set_logo(uuid, text) to authenticated;
