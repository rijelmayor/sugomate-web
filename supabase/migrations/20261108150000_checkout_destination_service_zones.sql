-- Require a configured destination service zone and use its Admin fee at checkout.
alter table public.customer_addresses
  add column if not exists service_zone_id uuid references public.service_zones(id);

create index if not exists customer_addresses_service_zone_lookup
  on public.customer_addresses(municipality_id, service_zone_id);

-- Existing saved addresses are intentionally not guessed; customers must select
-- the correct barangay/zone before their next order.
do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.place_customer_order(uuid,jsonb,text,text)'::regprocedure)
    into v_def;

  v_old := '  select r.delivery_fee into v_delivery_fee from public.delivery_routes r' || E'\n' ||
    '    where r.origin_municipality_id=v_origin_municipality and r.destination_municipality_id=v_address.municipality_id and r.is_active=true;' || E'\n' ||
    '  if v_delivery_fee is null then raise exception ''This store-to-destination route is not currently approved or priced. Please choose another address or contact support.''; end if;';
  v_new := '  if not exists(select 1 from public.delivery_routes r' || E'\n' ||
    '    where r.origin_municipality_id=v_origin_municipality and r.destination_municipality_id=v_address.municipality_id and r.is_active=true) then' || E'\n' ||
    '    raise exception ''This store-to-destination route is not currently approved. Please choose another address or contact support.'';' || E'\n' ||
    '  end if;' || E'\n' ||
    '  select z.base_delivery_fee into v_delivery_fee from public.service_zones z' || E'\n' ||
    '    where z.id=v_address.service_zone_id and z.municipality_id=v_address.municipality_id and z.is_active=true;' || E'\n' ||
    '  if v_delivery_fee is null then raise exception ''The selected barangay/zone has no active delivery fee. Please choose another zone or contact support.''; end if;';
  if position(v_old in v_def)>0 then
    v_def := replace(v_def,v_old,v_new);
  elsif position('z.base_delivery_fee' in v_def)=0 then
    raise exception 'Could not locate current route-fee lookup in place_customer_order; migration stopped safely.';
  end if;

  v_old := '''landmark'',v_address.landmark,''municipality_id'',v_address.municipality_id,''barangay_id'',v_address.barangay_id)';
  v_new := '''landmark'',v_address.landmark,''municipality_id'',v_address.municipality_id,''service_zone_id'',v_address.service_zone_id,';
  v_new := v_new || '''service_zone_name'',(select z.name from public.service_zones z where z.id=v_address.service_zone_id))';
  if position(v_old in v_def)>0 then
    v_def := replace(v_def,v_old,v_new);
  elsif position('service_zone_name' in v_def)=0 then
    raise exception 'Could not locate address snapshot fields in place_customer_order; migration stopped safely.';
  end if;

  execute v_def;
end;
$migration$;

comment on column public.customer_addresses.service_zone_id is
  'Required destination barangay/zone selected from Admin active service zones; checkout uses its configured base_delivery_fee.';
