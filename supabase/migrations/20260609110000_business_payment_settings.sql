-- Payment / bank details for invoices, stored on the single settings singleton
-- (os_company_settings, key = 'default'). Kept here rather than in a second
-- settings table so Settings has one source of truth. RLS is inherited from the
-- existing admin-only lockdown on os_company_settings — no new policies needed.

alter table os_company_settings
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_sort_code text,        -- stored as entered, e.g. '12-34-56'
  add column if not exists bank_account_number text,
  add column if not exists bank_iban text,
  add column if not exists bank_bic text,
  add column if not exists payment_terms text;          -- e.g. 'Payment due within 14 days'

-- Ensure the single default row exists so reads never come back empty.
insert into os_company_settings (key)
values ('default')
on conflict (key) do nothing;
