-- Add company details to workspace_settings
ALTER TABLE workspace_settings
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_postcode text,
  ADD COLUMN IF NOT EXISTS company_country text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_vat_number text;

-- Add account_type to finance_payments (cash vs bank)
ALTER TABLE finance_payments
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'bank'
    CHECK (account_type IN ('cash', 'bank'));
