-- SUGOMATE rider pickup-to-delivery duration tracking and audit timeline.
-- All timestamps are stored in UTC (timestamptz); Admin UI renders Asia/Manila.

create table if not exists public.order_delivery_timing_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  driver_user_id uuid references auth.users(id),
  event_type text not null check (event_type in ('picked_up','delivered','rider_handoff')),
  occurred_at timestamptz not null default now(),
  elapsed_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_delivery_timing_events_order_time_idx
  on public.order_delivery_timing_events(order_id,occurred_at);
create index if not exists order_delivery_timing_events_driver_time_idx
  on public.order_delivery_timing_events(driver_user_id,occurred_at desc)
  where driver_user_id is not null;

alter table public.order_delivery_timing_events enable row level security;
drop policy if exists "Admins read delivery timing events" on public.order_delivery_timing_events;
create policy "Admins read delivery timing events"
on public.order_delivery_timing_events for select to authenticated
using (app_private.has_role(auth.uid(),'admin'::public.app_role));
revoke all on public.order_delivery_timing_events from anon,authenticated;
grant select on public.order_delivery_timing_events to authenticated;

create or replace function public.capture_order_delivery_timing_events()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_duration integer;
begin
  if old.picked_up_at is null and new.picked_up_at is not null then
    insert into public.order_delivery_timing_events(order_id,driver_user_id,event_type,occurred_at,metadata)
    values(new.id,new.driver_user_id,'picked_up',new.picked_up_at,
      jsonb_build_object('order_number',new.order_number,'status',new.status));
  end if;

  if old.delivered_at is null and new.delivered_at is not null then
    if new.picked_up_at is not null then
      v_duration:=greatest(0,floor(extract(epoch from (new.delivered_at-new.picked_up_at)))::integer);
    end if;
    insert into public.order_delivery_timing_events(order_id,driver_user_id,event_type,occurred_at,elapsed_seconds,metadata)
    values(new.id,new.driver_user_id,'delivered',new.delivered_at,v_duration,
      jsonb_build_object('order_number',new.order_number,'pickup_at',new.picked_up_at));
  end if;

  if old.picked_up_at is not null and new.picked_up_at is not null
     and old.driver_user_id is distinct from new.driver_user_id then
    insert into public.order_delivery_timing_events(order_id,driver_user_id,event_type,occurred_at,metadata)
    values(new.id,new.driver_user_id,'rider_handoff',now(),
      jsonb_build_object('previous_driver_user_id',old.driver_user_id,
        'new_driver_user_id',new.driver_user_id,'order_number',new.order_number,
        'delivery_elapsed_seconds',greatest(0,floor(extract(epoch from (now()-new.picked_up_at)))::integer)));
  end if;
  return new;
end;
$$;

drop trigger if exists capture_order_delivery_timing_events on public.orders;
create trigger capture_order_delivery_timing_events
after update of picked_up_at,delivered_at,driver_user_id on public.orders
for each row execute function public.capture_order_delivery_timing_events();
revoke all on function public.capture_order_delivery_timing_events() from public,anon,authenticated;

-- Backfill timestamp events for orders that were already picked up or delivered
-- before this migration. The current assigned rider is recorded as the known owner.
insert into public.order_delivery_timing_events(order_id,driver_user_id,event_type,occurred_at,elapsed_seconds,metadata)
select o.id,o.driver_user_id,'picked_up',o.picked_up_at,null,
  jsonb_build_object('order_number',o.order_number,'backfilled',true)
from public.orders o
where o.picked_up_at is not null
  and not exists(select 1 from public.order_delivery_timing_events e where e.order_id=o.id and e.event_type='picked_up');

insert into public.order_delivery_timing_events(order_id,driver_user_id,event_type,occurred_at,elapsed_seconds,metadata)
select o.id,o.driver_user_id,'delivered',o.delivered_at,
  case when o.picked_up_at is not null then greatest(0,floor(extract(epoch from (o.delivered_at-o.picked_up_at)))::integer) end,
  jsonb_build_object('order_number',o.order_number,'pickup_at',o.picked_up_at,'backfilled',true)
from public.orders o
where o.delivered_at is not null
  and not exists(select 1 from public.order_delivery_timing_events e where e.order_id=o.id and e.event_type='delivered');
