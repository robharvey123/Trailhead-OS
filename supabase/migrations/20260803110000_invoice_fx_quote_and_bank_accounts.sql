-- Multi-currency invoicing, part 2.
--
-- 1. Store the quoted FX pair (foreign units per 1 GBP, e.g. 1.34810000) as
--    ENTERED, and keep fx_rate_to_gbp as the derived full-precision inverse. A
--    rounded inverse (0.74179) drifts by pennies on large invoices; the quote is
--    the number the client's accounts team recognises, so store it and invert at
--    read. Nullable — existing/GBP invoices leave it null (GBP quote is 1).
alter table invoices
  add column if not exists fx_rate_quote numeric(18,8);

comment on column invoices.fx_rate_quote is
  '1 GBP = this many of invoices.currency, as quoted (e.g. 1.34810000 for USD). Display value; fx_rate_to_gbp = 1/fx_rate_quote at full precision is used for GBP maths.';

-- 2. Per-currency company bank accounts, so a USD invoice shows the USD account
--    and a GBP invoice keeps using company_settings. Currency is the key. Admin
--    only. No bank data lives in this migration — rows are inserted separately.
create table if not exists company_bank_accounts (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  account_name text,
  bank_name text,
  account_number text,
  sort_code text,
  iban text,
  bic text,
  bank_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists company_bank_accounts_updated_at on company_bank_accounts;
create trigger company_bank_accounts_updated_at
  before update on company_bank_accounts
  for each row execute function update_workspace_updated_at();

alter table company_bank_accounts enable row level security;

drop policy if exists company_bank_accounts_admin on company_bank_accounts;
create policy company_bank_accounts_admin on company_bank_accounts for all
  using (is_admin()) with check (is_admin());
