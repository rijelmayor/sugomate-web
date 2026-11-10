-- Verify the OTP and credit the exact customer request in one database transaction.
-- This prevents concurrent replay and ensures a failed credit never consumes the OTP.
create or replace function public.wallet_admin_verify_and_credit_topup(
  p_request_id uuid,
  p_admin_id uuid,
  p_candidate_hash text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge public.wallet_authorization_challenges%rowtype;
  v_tx uuid;
begin
  if not exists(select 1 from public.user_roles where user_id=p_admin_id and role='admin') then
    raise exception 'admin_required' using errcode='42501';
  end if;
  select * into v_challenge
    from public.wallet_authorization_challenges
    where top_up_request_id=p_request_id and consumed_at is null
    order by created_at desc limit 1 for update;
  if not found then raise exception 'otp_missing'; end if;
  if v_challenge.expires_at <= now() then raise exception 'otp_expired'; end if;
  if v_challenge.attempts >= 5 then raise exception 'otp_locked'; end if;
  if v_challenge.otp_hash <> p_candidate_hash then
    update public.wallet_authorization_challenges
      set attempts=least(attempts+1,5) where id=v_challenge.id;
    return null;
  end if;
  v_tx := public.wallet_admin_credit_topup(p_request_id,p_admin_id);
  update public.wallet_authorization_challenges
    set consumed_at=now() where id=v_challenge.id and consumed_at is null;
  if not found then raise exception 'otp_already_used'; end if;
  return v_tx;
end;
$$;
revoke all on function public.wallet_admin_verify_and_credit_topup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.wallet_admin_verify_and_credit_topup(uuid,uuid,text) to service_role;

-- The original order proof trigger is replaced in the preceding migration. Mark
-- the historical backfill accurately where a proof was already verified.
update public.gcash_payment_proof_history
set event_type='proof_verified'
where verified_at is not null and event_type='proof_submitted';
