-- Starter merchant types; admins can rename, reorder, activate or add more from the control room.
insert into public.merchant_categories(name,slug,icon,sort_order,is_active)
values
  ('Food & Meals','food-meals','🍱',10,true),
  ('Groceries','groceries','🛒',20,true),
  ('Flower Shop','flower-shop','💐',30,true),
  ('Drinks & Desserts','drinks-desserts','🥤',40,true),
  ('Pharmacy','pharmacy','💊',50,true),
  ('Bakery','bakery','🥐',60,true),
  ('Hardware','hardware','🛠️',70,true),
  ('Pabili & Essentials','pabili-essentials','🧺',80,true)
on conflict (slug) do nothing;
