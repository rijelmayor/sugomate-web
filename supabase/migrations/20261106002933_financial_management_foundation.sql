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
¶»§q«^