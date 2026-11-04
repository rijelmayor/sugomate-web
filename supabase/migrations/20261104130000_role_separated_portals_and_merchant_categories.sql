-- Role-separated customer, merchant, delivery partner and admin portals.
-- A user with an operational role cannot also hold the customer role.
create or replace function public.enforce_exclusive_customer_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'customer'::public.app_role then
    if exists (
      select 1 from public.user_roles ur
      where ur.user_id = new.user_id
        and ur.role in ('merchant'::public.app_role, 'driver'::public.app_role, 'admin'::public.app_role)
    ) then
      raise exception 'Operational accounts cannot be assigned the customer role.';
    end if;
  else
    delete from public.user_roles
    where user_id = new.user_id
      and role = 'customer'::public.app_role;
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_exclusive_customer on public.user_roles;
create trigger user_roles_exclusive_customer
before insert or update of role on public.user_roles
for each row execute function public.enforce_exclusive_customer_role();

delete from public.user_roles elevated
using public.user_roles customer_role
where elevated.user_id = customer_role.user_id
  and elevated.role in ('merchant'::public.app_role, 'driver'::public.app_role, 'admin'::public.app_role)
  and customer_role.role = 'customer'::public.app_role;

create table if not exists public.merchant_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default '🏪',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint merchant_categories_name_length check (char_length(trim(name)) between 2 and 80),
  constraint merchant_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

alter table public.merchants
  add column if not exists category_id uuid references public.merchant_categories(id) on delete set null;

alter table public.merchant_categories enable row level security;
grant select on public.merchant_categories to anon, authenticated;
grant insert, update, delete on public.merchant_categories to authenticated;

drop policy if exists "Anyone reads active merchant categories" on public.merchant_categories;
create policy "Anyone reads active merchant categories"
on public.merchant_categories for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'::public.app_role
  )
);

drop policy if exists "Admins manage merchant categories" on public.merchant_categories;
create policy "Admins manage merchant categories"
on public.merchant_categories for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'::public.app_role
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'::public.app_role
  )
);

create index if not exists merchants_category_id_idx on public.merchants(category_id);
create index if not exists merchant_categories_active_sort_idx
  on public.merchant_categories(is_active, sort_order, name);
