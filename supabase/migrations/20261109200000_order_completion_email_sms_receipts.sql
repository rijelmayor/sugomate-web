-- Durable, idempotent customer receipts after rider-confirmed delivery.
create table if not exists public.order_completion_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  email_status text not null default 'pending'
    check (email_status in ('pending','sent','failed','skipped')),
  sms_status text not null default 'pending'
    check (sms_status in ('pending','sent','failed','skipped')),
  email_attempts integer not null default 0 check (email_attempts >= 0),
  sms_attempts integer not null default 0 check (sms_attempts >= 0),
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_completion_receipts_order_id_key unique(order_id)
);

create index if not exists order_completion_receipts_pending_idx
  on public.order_completion_receipts(created_at)
  where completed_at is null;

alter table public.order_completion_receipts enable row level security;
revoke all on public.order_completion_receipts from public, anon, authenticated;
grant all on public.order_completion_receipts to service_role;

create or replace function public.enqueue_order_completion_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'delivered'
     and new.status = 'delivered'
     and new.delivered_at is not null then
    insert into public.order_completion_receipts(order_id, customer_id)
    values (new.id, new.customer_id)
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_order_completion_receipt() from public, anon, authenticated;

drop trigger if exists enqueue_order_completion_receipt on public.orders;
create trigger enqueue_order_completion_receipt
after update of status on public.orders
for each row
when (old.status is distinct from new.status and new.status = 'delivered')
execute function public.enqueue_order_completion_receipt();

-- Atomically claim work so concurrent cron invocations cannot send the same receipt.
create or replace function public.claim_order_completion_receipts(p_limit integer default 10)
returns setof public.order_completion_receipts
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Claim limit must be between 1 and 50.';
  end if;

  return query
  update public.order_completion_receipts r
  set locked_at = now(), updated_at = now()
  where r.id in (
    select q.id
    from public.order_completion_receipts q
    where q.completed_at is null
      and (q.locked_at is null or q.locked_at < now() - interval '10 minutes')
      and (
        (q.email_status in ('pending','failed') and q.email_attempts < 5)
        or (q.sms_status in ('pending','failed') and q.sms_attempts < 5)
      )
    order by q.created_at
    for update skip locked
    limit p_limit
  )
  returning r.*;
end;
$$;

revoke all on function public.claim_order_completion_receipts(integer) from public, anon, authenticated;
grant execute on function public.claim_order_completion_receipts(integer) to service_role;
