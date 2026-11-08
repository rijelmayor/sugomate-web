-- Restore the eight product categories and calculate delivery usage only after resolving the zone fee.
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

do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
  v_fee_anchor text;
  v_usage_block text;
begin
  select pg_get_functiondef('public.place_customer_order(uuid,jsonb,text,text)'::regprocedure)
    into v_def;

  v_old := $old$
  if v_settings.delivery_usage_enabled then
    v_delivery_method:=v_settings.delivery_usage_method;
    v_delivery_rate:=v_settings.delivery_usage_value;
    if v_delivery_method='percentage' then
      if v_delivery_rate>100 then raise exception 'Delivery System Usage cannot exceed 100 percent.'; end if;
      v_delivery_usage:=round(v_delivery_fee*v_delivery_rate/100,2);
    else
      v_delivery_usage:=v_delivery_rate;
    end if;
    if v_delivery_usage>v_delivery_fee then
      raise exception 'Configured Delivery System Usage exceeds this delivery base rate. Admin must adjust the rate before checkout.';
    end if;
  end if;
$old$;

  v_usage_block := $usage$
  if v_settings.delivery_usage_enabled then
    v_delivery_method:=v_settings.delivery_usage_method;
    v_delivery_rate:=v_settings.delivery_usage_value;
    if v_delivery_method='percentage' then
      if v_delivery_rate>100 then raise exception 'Delivery System Usage cannot exceed 100 percent.'; end if;
      v_delivery_usage:=round(v_delivery_fee*v_delivery_rate/100,2);
    else
      v_delivery_usage:=v_delivery_rate;
    end if;
    if v_delivery_usage>v_delivery_fee then
      raise exception 'Configured Delivery System Usage exceeds this delivery base rate. Admin must adjust the rate before checkout.';
    end if;
  end if;
$usage$;

  if position(v_old in v_def)=0 then
    raise exception 'Could not locate delivery usage calculation block; checkout function was not changed.';
  end if;
  v_def := replace(v_def, v_old, E'  -- Delivery usage is calculated after the destination fee is resolved.\n');

  v_fee_anchor := $anchor$
  if v_delivery_fee is null then raise exception 'The selected barangay/zone has no active delivery fee. Please choose another zone or contact support.'; end if;
$anchor$;
  if position(v_fee_anchor in v_def)=0 then
    raise exception 'Could not locate destination fee validation; checkout function was not changed.';
  end if;
  v_def := replace(v_def, v_fee_anchor, v_fee_anchor || E'\n' || v_usage_block);

  execute v_def;
end;
$migration$;
