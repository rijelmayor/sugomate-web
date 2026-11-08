-- Align merchant product-category choices with the eight marketplace business categories.
-- Store categories (merchant_categories) and product categories are separate taxonomies;
-- these additions make the missing pharmacy, bakery, hardware, and flower options selectable
-- when merchants classify products.
insert into public.product_categories (name, slug, icon, sort_order, is_active)
values
  ('Flower Shop', 'flower-shop', '💐', 50, true),
  ('Pharmacy', 'pharmacy', '💊', 60, true),
  ('Bakery', 'bakery', '🥐', 70, true),
  ('Hardware', 'hardware', '🛠️', 80, true)
on conflict (slug) do update
set name = excluded.name,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_active = true;
