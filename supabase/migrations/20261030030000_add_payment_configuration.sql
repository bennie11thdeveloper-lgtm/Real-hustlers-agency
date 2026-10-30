alter table public.application_payments
  drop constraint if exists application_payments_amount_check,
  drop constraint if exists application_payments_currency_check;

alter table public.application_payments
  alter column amount type numeric(12, 2) using amount::numeric(12, 2),
  add constraint application_payments_amount_check check (amount > 0),
  add constraint application_payments_currency_check check (currency in ('UGX', 'USD')),
  add column provider text not null default 'flutterwave'
    check (provider in ('flutterwave', 'paypal', 'pesapal', 'mtn_momo', 'airtel_money')),
  add column provider_order_id text,
  add column base_amount_ugx bigint not null default 150000,
  add column exchange_rate numeric(18, 8),
  add constraint application_payments_base_amount_ugx_check check (base_amount_ugx > 0),
  add constraint application_payments_exchange_rate_check check (exchange_rate is null or exchange_rate > 0);

create unique index application_payments_provider_order_id_key
  on public.application_payments (provider, provider_order_id)
  where provider_order_id is not null;

create table public.payment_provider_credentials (
  provider text primary key check (provider in ('paypal', 'pesapal', 'mtn_momo', 'airtel_money')),
  encrypted_config text not null,
  environment text not null check (environment in ('sandbox', 'live')),
  updated_at timestamptz not null default now()
);

alter table public.payment_provider_credentials enable row level security;
revoke all on public.payment_provider_credentials from public, anon, authenticated;
grant all on public.payment_provider_credentials to service_role;

update public.site_content
set content = jsonb_set(
  content,
  '{payments}',
  '{
    "feeUgx": 150000,
    "usdConversion": "automatic",
    "terms": "",
    "enabledProviders": ["flutterwave"]
  }'::jsonb,
  true
)
where id = 'public'
  and not (content ? 'payments');
