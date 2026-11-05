-- Admin-managed category photos. Public read (shown on the customer home page); only admins can write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('category-images', 'category-images', true, 2097152, array['image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];

drop policy if exists "Admins upload category images" on storage.objects;
create policy "Admins upload category images" on storage.objects for insert to authenticated
with check (bucket_id = 'category-images' and exists (
  select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role));

drop policy if exists "Admins update category images" on storage.objects;
create policy "Admins update category images" on storage.objects for update to authenticated
using (bucket_id = 'category-images' and exists (
  select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role))
with check (bucket_id = 'category-images' and exists (
  select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role));

drop policy if exists "Admins delete category images" on storage.objects;
create policy "Admins delete category images" on storage.objects for delete to authenticated
using (bucket_id = 'category-images' and exists (
  select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'::public.app_role));

-- Categories with no uploaded photo use the gradient default: clear the placeholder file paths seeded earlier.
update public.merchant_categories set image_url = null where image_url like '/images/categories/%';
