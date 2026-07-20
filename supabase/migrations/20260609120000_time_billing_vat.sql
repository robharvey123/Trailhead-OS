-- Consulting billing loop: link time entries to invoices so unbilled hours can be
-- pulled onto an invoice and marked billed, and add VAT-registration settings to
-- the single company-settings row. New time_entries columns inherit the existing
-- RLS policies — no new policies needed.

alter table time_entries
  add column if not exists invoice_id uuid references invoices(id) on delete set null,
  add column if not exists billed boolean not null default false;

create index if not exists idx_time_entries_unbilled
  on time_entries (engagement_id) where billable and not billed;

alter table os_company_settings
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text;
