alter table invoices
  add column if not exists account_id uuid
  references accounts(id) on delete set null;

create index if not exists idx_invoices_account_id on invoices(account_id);
