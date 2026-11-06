-- SUGOMATE financial management foundation.
-- Settings default to inactive so no customer/partner pricing changes until Admin enables them.

create table if not exists public.platform_financial_settings (
  id smallint primary key default 1 check (id = 1),
  merchant_usage_enabled boolean not null default false,
  merchant_usage_method text not null default 'percentage' check (merchant_usage_method in ('percentage','fixed')),
  merchant_usage_value numeric(12,2) not null default 0 check (merchant_usage_value >= 0 and merchant_usage_value <= 1000),
  delivery_usage_enabled boolean not null default false,
  delivery_usage_method text not null default 'percentage' check (delivery_usage_method in ('percentage','fixed')),
  delivery_usage_value numeric(12,2) not null default 0 check (delivery_usage_value >= 0 and delivery_usage_value <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.platform_financial_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.merchant_billing_statements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  period_start date not null,
  period_end date not null,
  total_system_usage numeric(12,2) not null default 0 check (total_system_usage >= 0),
  status text not null default 'draft' check (status in ('draft','issued','paid','void')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  issued_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  admin_note text,
  check (period_end >= period_start)
);

create table if not exists public.merchant_system_usage_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  merchant_id uuid not null references public.merchants(id),
  statement_id uuid references public.merchant_billing_statements(id),
  order_date date not null default ((now() at time zone 'Asia/Manila')::date),
  merchant_srp_subtotal numeric(12,2) not null check (merchant_srp_subtotal >= 0),
  usage_method text not null check (usage_method in ('percentage','fixed')),
  usage_rate numeric(12,2) not null check (usage_rate >= 0),
  system_usage_amount numeric(12,2) not null check (system_usage_amount >= 0),
  status text not null default 'unbilled' check (status in ('unbilled','billed','paid','void')),
  created_at timestamptz not null default now()
);

create table if not exists public.driver_earnings_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  driver_user_id uuid not null references auth.users(id),
  driver_base_rate numeric(12,2) not null check (driver_base_rate >= 0),
  usage_method text not null check (usage_method in ('percentage','fixed')),
  usage_rate numeric(12,2) not null check (usage_rate >= 0),
  delivery_system_usage numeric(12,2) not null check (delivery_system_usage >= 0),
  net_delivery_earnings numeric(12,2) not null check (net_delivery_earnings >= 0),
  status text not null default 'earned' check (status in ('earned','adjusted','paid','void')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (delivery_system_usage <= driver_base_rate),
  check (net_delivery_earnings = driver_base_rate - delivery_system_usage)
);

create table if not exists public.driver_benefit_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text,
  benefit_type text not null check (benefit_type in ('bonus','incentive','allowance','referral','other')),
  calculation_method text not null default 'fixed' check (calculation_method in ('fixed','percentage')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.driver_benefit_entries (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid not null references auth.users(id),
  program_id uuid not null references public.driver_benefit_programs(id),
  source_order_id uuid references public.orders(id),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  paid_at timestamptz,
  unique (driver_user_id, program_id, source_order_id)
);

create table if not exists public.driver_payout_requests (
  id uuid primary key default gen_random_uuid(),
  driver_user_id uuid not null references auth.users(id),
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paid','cancelled')),
  payout_method text,
  payout_account_snapshot jsonb,
  driver_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  payment_reference text
);

create index if not exists merchant_usage_unbilled_idx on public.merchant_system_usage_entries (merchant_id, order_date) where status = 'unbilled';
create index if not exists merchant_statements_period_idx on public.merchant_billing_statements (merchant_id, period_start desc);
create index if not exists driver_earnings_driver_idx on public.driver_earnings_entries (driver_user_id, created_at desc);
create index if not exists driver_benefit_entries_driver_idx on public.driver_benefit_entries (driver_user_id, created_at desc);
create index if not exists driver_payout_requests_driver_idx on public.driver_payout_requests (driver_user_id, requested_at desc);

alter table public.platform_financial_settings enable row level security;
alter table public.merchant_billing_statements enable row level security;
alter table public.merchant_system_usage_entries enable row level security;
alter table public.driver_earnings_entries enable row level security;
alter table public.driver_benefit_programs enable row level security;
alter table public.driver_benefit_entries enable row level security;
alter table public.driver_payout_requests enable row level security;

create policy "Admin manages platform financial settings" on public.platform_financial_settings
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Authenticated users read active pricing configuration" on public.platform_financial_settings
for select to authenticated using (true);

create policy "Admin manages merchant billing statements" on public.merchant_billing_statements
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Merchant members read own billing statements" on public.merchant_billing_statements
for select to authenticated
using (exists (select 1 from public.merchant_members mm where mm.merchant_id = merchant_billing_statements.merchant_id and mm.user_id = (select auth.uid())));

create policy "Admin manages merchant usage entries" on public.merchant_system_usage_entries
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Merchant members read own usage entries" on public.merchant_system_usage_entries
for select to authenticated
using (exists (select 1 from public.merchant_members mm where mm.merchant_id = merchant_system_usage_entries.merchant_id and mm.user_id = (select auth.uid())));

create policy "Admin manages driver earnings entries" on public.driver_earnings_entries
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Drivers read own earnings entries" on public.driver_earnings_entries
for select to authenticated
using (driver_user_id = (select auth.uid()));

create policy "Admin manages driver benefit programs" on public.driver_benefit_programs
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Drivers read active benefit programs" on public.driver_benefit_programs
for select to authenticated
using (is_active = true and exists (select 1 from public.driver_profiles dp where dp.user_id = (select auth.uid())));

create policy "Admin manages driver benefit entries" on public.driver_benefit_entries
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Drivers read own benefit entries" on public.driver_benefit_entries
for select to authenticated
using (driver_user_id = (select auth.uid()));

create policy "Admin manages driver payout requests" on public.driver_payout_requests
for all to authenticated
using ((select app_private.has_role((select auth.uid()), 'admin'::app_role)))
with check ((select app_private.has_role((select auth.uid()), 'admin'::app_role)));
create policy "Drivers read and request own payouts" on public.driver_payout_requests
for select to authenticated
using (driver_user_id = (select auth.uid()));
create policy "Drivers create own payout requests" on public.driver_payout_requests
for insert to authenticated
with check (driver_user_id = (select auth.uid()) and status = 'pending' and exists (select 1 from public.driver_profiles dp where dp.user_id = (select auth.uid()) and dp.status = 'active'::account_status));

grant select, insert, update, delete on public.platform_financial_settings to authenticated;
grant select, insert, update, delete on public.merchant_billing_statements to authenticated;
grant select, insert, update, delete on public.merchant_system_usage_entries to authenticated;
grant select, insert, update, delete on public.driver_earnings_entries to authenticated;
grant select, insert, update, delete on public.driver_benefit_programs to authenticated;
grant select, insert, update, delete on public.driver_benefit_entries to authenticated;
grant select, update, delete on public.driver_payout_requests to authenticated;
revoke insert on public.driver_payout_requests from authenticated;

