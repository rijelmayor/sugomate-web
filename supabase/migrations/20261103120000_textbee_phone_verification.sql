-- Mandatory mobile verification for newly registered SUGOMATE accounts.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

-- Preserve access for accounts that existed before phone verification became mandatory.
update public.profiles
set phone_verified_at = coalesce(phone_verified_at, now())
where phone_verified_at is null;

create table if not exists public.phone_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id),
  unique (email)
);

alter table public.phone_verification_challenges enable row level security;
revoke all on public.phone_verification_challenges from anon, authenticated;
grant all on public.phone_verification_challenges to service_role;

create index if not exists phone_verification_challenges_expires_at_idx
  on public.phone_verification_challenges (expires_at);
