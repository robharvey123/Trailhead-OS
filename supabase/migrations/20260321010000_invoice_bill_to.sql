-- Add bill-to (recipient) address fields to finance_invoices
ALTER TABLE finance_invoices
  ADD COLUMN IF NOT EXISTS bill_to_name           text,
  ADD COLUMN IF NOT EXISTS bill_to_address        text,
  ADD COLUMN IF NOT EXISTS bill_to_city           text,
  ADD COLUMN IF NOT EXISTS bill_to_postcode       text,
  ADD COLUMN IF NOT EXISTS bill_to_country        text,
  ADD COLUMN IF NOT EXISTS bill_to_email          text,
  ADD COLUMN IF NOT EXISTS bill_to_phone          text,
  ADD COLUMN IF NOT EXISTS bill_to_vat_number     text,
  ADD COLUMN IF NOT EXISTS bill_to_company_number text;
