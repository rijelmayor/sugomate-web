-- Photo-based category tiles. image_url may be a site path (/images/categories/x.jpg) or an https URL.
alter table public.merchant_categories add column if not exists image_url text;
alter table public.merchant_categories drop constraint if exists merchant_categories_image_url_format;
alter table public.merchant_categories add constraint merchant_categories_image_url_format
  check (image_url is null or image_url ~ '^(/|https://)' and char_length(image_url) <= 500);

update public.merchant_categories set image_url = '/images/categories/' || slug || '.jpg'
where image_url is null
  and slug in ('food-meals','groceries','flower-shop','drinks-desserts','pharmacy','bakery','hardware','pabili-essentials');
