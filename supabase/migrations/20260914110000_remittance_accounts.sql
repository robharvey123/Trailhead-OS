-- ============================================================================
-- Remittance accounts: the beneficiary blocks printed on invoices, per
-- currency and payment rail (UK local / SEPA / SWIFT / US local ACH). A
-- currency can carry several blocks (USD prints US local first, SWIFT second,
-- by sort_order). Supersedes the one-row-per-currency company_bank_accounts
-- for rendering: when active rows exist here for an invoice's currency, the
-- PDF/email print these instead of the legacy block.
--
-- NEVER seeded: Rob enters real values through Settings in production. No
-- account data lives in the repo.
-- ============================================================================

create table if not exists remittance_accounts (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('GBP','EUR','USD')),
  rail text not null check (rail in ('uk_local','sepa','swift','us_local')),
  label text not null,
  beneficiary_name text not null,
  beneficiary_address text,
  bank_name text,
  bank_address text,
  iban text,
  bic text,
  intermediary_bic text,
  account_number text,
  sort_code text,
  routing_number text,
  account_type text,
  notes text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists remittance_accounts_currency_active_idx
  on remittance_accounts (currency, active, sort_order);

drop trigger if exists remittance_accounts_updated_at on remittance_accounts;
create trigger remittance_accounts_updated_at
  before update on remittance_accounts
  for each row execute function update_workspace_updated_at();

-- RLS: same shape as os_company_settings (single-user admin app; service role
-- for server reads).
alter table remittance_accounts enable row level security;
drop policy if exists "authenticated full access remittance_accounts" on remittance_accounts;
create policy "authenticated full access remittance_accounts" on remittance_accounts
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
