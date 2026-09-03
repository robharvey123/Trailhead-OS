-- Invoicing v2 phase 2: billing profile on accounts so client data flows from
-- the CRM to invoices, plus per-invoice VAT/company/PO snapshot fields.
alter table accounts
  add column if not exists vat_number         text,
  add column if not exists company_number     text,
  add column if not exists billing_email      text,
  add column if not exists payment_terms_days integer,
  add column if not exists po_required        boolean not null default false;

alter table invoices
  add column if not exists bill_to_vat_number     text,
  add column if not exists bill_to_company_number text,
  add column if not exists po_number              text,
  add column if not exists vat_note               text;  -- e.g. reverse-charge wording, printed on the PDF

alter table os_company_settings
  add column if not exists default_payment_terms_days integer not null default 14;

-- Invoicing v2 phase 1: pricing tiers are removed from the invoice flow. The
-- column stays for historical invoices and the engagement views.
comment on column invoices.pricing_tier_id is 'Deprecated, no longer written. Retained for historical invoices.';
