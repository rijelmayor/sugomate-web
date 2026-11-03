-- SUGOMATE marketplace catalog foundation
-- Safe to apply after review. Existing account, merchant, and location tables are unchanged.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default '🛍️',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  branch_id uuid not null references public.merchant_branches(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  image_url text,
  is_available boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  preparation_minutes integer check (preparation_minutes is null or preparation_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_branch_matches_merchant
    check (merchant_id is not null and branch_id is not null)
);

create index if not exists products_catalog_idx
  on public.products (category_id, is_available, merchant_id);
create index if not exists products_branch_idx
  on public.products (branch_id);
create index if not exists products_merchant_idx
  on public.products (merchant_id, created_at desc);

alter table public.product_categories enable row level security;
alter table public.products enable row level security;

grant select on public.product_categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Active product categories are public" on public.product_categories;
create policy "Active product categories are public"
  on public.product_categories for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Available products from approved active stores are public" on public.products;
create policy "Available products from approved active stores are public"
  on public.products for select
  to anon, authenticated
  using (
    is_available = true
    and (stock_quantity is null or stock_quantity > 0)
    and exists (
      select 1 from public.merchants m
      join public.merchant_branches b on b.merchant_id = m.id
      where m.id = products.merchant_id
        and b.id = products.branch_id
        and m.status = 'approved'
        and b.is_active = true
    )
  );

drop policy if exists "Approved merchant members can add products" on public.products;
create policy "Approved merchant members can add products"
  on public.products for insert
  to authenticated
  with check (
    exists (
      select 1 from public.merchant_members mm
      join public.merchants m on m.id = mm.merchant_id
      join public.merchant_branches b on b.merchant_id = m.id
      where mm.user_id = (select auth.uid())
        and mm.merchant_id = products.merchant_id
        and b.id = products.branch_id
        and m.status = 'approved'
    )
  );

drop policy if exists "Approved merchant members can update own products" on public.products;
create policy "Approved merchant members can update own products"
  on public.products for update
  to authenticated
  using (
    exists (
      select 1 from public.merchant_members mm
      join public.merchants m on m.id = mm.merchant_id
      join public.merchant_branches b on b.merchant_id = m.id
      where mm.user_id = (select auth.uid())
        and mm.merchant_id = products.merchant_id
        and b.id = products.branch_id
        and m.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.merchant_members mm
      join public.merchants m on m.id = mm.merchant_id
      join public.merchant_branches b on b.merchant_id = m.id
      where mm.user_id = (select auth.uid())
        and mm.merchant_id = products.merchant_id
        and b.id = products.branch_id
        and m.status = 'approved'
    )
  );

drop policy if exists "Approved merchant members can delete own products" on public.products;
create policy "Approved merchant members can delete own products"
  on public.products for delete
  to authenticated
  using (
    exists (
      select 1 from public.merchant_members mm
      join public.merchants m on m.id = mm.merchant_id
      where mm.user_id = (select auth.uid())
        and mm.merchant_id = products.merchant_id
        and m.status = 'approved'
    )
  );

insert into public.product_categories (name, slug, icon, sort_order)
values
  ('Food & meals', 'food-meals', '🍱', 10),
  ('Groceries', 'groceries', '🛒', 20),
  ('Drinks & desserts', 'drinks-desserts', '🥤', 30),
  ('Pabili & essentials', 'pabili-essentials', '🧺', 40)
on conflict (slug) do nothing;
