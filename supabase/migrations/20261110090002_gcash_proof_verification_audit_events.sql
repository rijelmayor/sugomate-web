-- Preserve GCash proof submission and verification as separate immutable audit events.
-- This migration only changes the wallet/audit branch; it does not alter order payment logic.

alter table public.gcash_payment_proof_history
  add column if not exists event_type text not null default 'proof_submitted'
  check (event_type in ('proof_submitted','proof_verified','proof_rejected','proof_superseded'));

create index if not exists gcash_payment_proof_history_event_idx
  on public.gcash_payment_proof_history(order_id, captured_at desc, event_type);

create or replace function public.capture_gcash_payment_proof_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.gcash_payment_proof_path is not null then
      insert into public.gcash_payment_proof_history (
        order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
        submitted_at, verified_at, verified_by, verification_status, event_type
      ) values (
        new.id, new.customer_id, new.merchant_id, new.gcash_payment_reference,
        new.gcash_payment_proof_path, greatest(coalesce(new.total,0),0.01),
        coalesce(new.gcash_payment_submitted_at, now()),
        new.gcash_payment_verified_at, new.gcash_payment_verified_by,
        case when new.gcash_payment_verified_at is not null then 'verified' else 'submitted' end,
        case when new.gcash_payment_verified_at is not null then 'proof_verified' else 'proof_submitted' end
      );
    end if;
    return new;
  end if;

  -- A replacement proof is a new submission. Keep the previous image reference
  -- and append a superseded event rather than overwriting/deleting its audit record.
  if new.gcash_payment_proof_path is distinct from old.gcash_payment_proof_path
     and new.gcash_payment_proof_path is not null then
    if old.gcash_payment_proof_path is not null then
      insert into public.gcash_payment_proof_history (
        order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
        submitted_at, verified_at, verified_by, verification_status, event_type
      ) values (
        old.id, old.customer_id, old.merchant_id, old.gcash_payment_reference,
        old.gcash_payment_proof_path, greatest(coalesce(old.total,0),0.01),
        coalesce(old.gcash_payment_submitted_at, now()),
        old.gcash_payment_verified_at, old.gcash_payment_verified_by,
        'superseded', 'proof_superseded'
      );
    end if;

    insert into public.gcash_payment_proof_history (
      order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
      submitted_at, verified_at, verified_by, verification_status, event_type
    ) values (
      new.id, new.customer_id, new.merchant_id, new.gcash_payment_reference,
      new.gcash_payment_proof_path, greatest(coalesce(new.total,0),0.01),
      coalesce(new.gcash_payment_submitted_at, now()),
      new.gcash_payment_verified_at, new.gcash_payment_verified_by,
      case when new.gcash_payment_verified_at is not null then 'verified' else 'submitted' end,
      case when new.gcash_payment_verified_at is not null then 'proof_verified' else 'proof_submitted' end
    );
  elsif new.gcash_payment_proof_path is not null
    and (
      new.gcash_payment_verified_at is distinct from old.gcash_payment_verified_at
      or new.gcash_payment_verified_by is distinct from old.gcash_payment_verified_by
    ) then
    -- Verification is an independent immutable event linked to the exact proof.
    insert into public.gcash_payment_proof_history (
      order_id, customer_id, merchant_id, payment_reference, proof_path, amount,
      submitted_at, verified_at, verified_by, verification_status, event_type
    ) values (
      new.id, new.customer_id, new.merchant_id, new.gcash_payment_reference,
      new.gcash_payment_proof_path, greatest(coalesce(new.total,0),0.01),
      coalesce(new.gcash_payment_submitted_at, now()),
      new.gcash_payment_verified_at, new.gcash_payment_verified_by,
      case when new.gcash_payment_verified_at is not null then 'verified' else 'submitted' end,
      case when new.gcash_payment_verified_at is not null then 'proof_verified' else 'proof_rejected' end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists capture_gcash_payment_proof_history on public.orders;
create trigger capture_gcash_payment_proof_history
after insert or update of
  gcash_payment_proof_path,
  gcash_payment_verified_at,
  gcash_payment_verified_by
on public.orders
for each row execute function public.capture_gcash_payment_proof_history();

comment on column public.gcash_payment_proof_history.event_type is
  'Immutable event type: initial submission, verification, rejection/reset, or superseded proof.';
