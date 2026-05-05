alter table invoices
  add column if not exists next_invoice_date date;

create index if not exists idx_invoices_next_invoice_date
  on invoices (next_invoice_date)
  where is_recurring = true;
