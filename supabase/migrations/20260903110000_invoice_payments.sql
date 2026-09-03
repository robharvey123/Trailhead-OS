-- Invoicing v2 phase 3: payment ledger. paid_at on invoices becomes a derived
-- mirror of the settling payment date (the engagement views select it), never a
-- manual field. Part payment widens the status set.
create table if not exists invoice_payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  paid_on     date not null default current_date,
  amount      numeric(12,2) not null check (amount > 0),
  currency    text not null default 'GBP',
  method      text check (method in ('bank_transfer','stripe','card','cash','cheque','other')),
  reference   text,
  notes       text,
  stripe_payment_intent_id text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_invoice_payments_invoice_id on invoice_payments(invoice_id);
create index if not exists idx_invoice_payments_paid_on    on invoice_payments(paid_on);

drop trigger if exists invoice_payments_updated_at on invoice_payments;
create trigger invoice_payments_updated_at
  before update on invoice_payments
  for each row execute function update_workspace_updated_at();

alter table invoice_payments enable row level security;
drop policy if exists "authenticated full access" on invoice_payments;
create policy "authenticated full access" on invoice_payments
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Widen invoice status for part payment.
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft','sent','part_paid','paid','overdue','cancelled'));

-- Backfill: every invoice already marked paid gets one ledger row on its paid_at date.
insert into invoice_payments (invoice_id, paid_on, amount, currency, method, notes)
select
  i.id,
  coalesce(i.paid_at::date, i.issue_date),
  round(
    coalesce((select sum((li->>'qty')::numeric * (li->>'unit_price')::numeric)
              from jsonb_array_elements(i.line_items) li), 0)
    * (1 + coalesce(i.vat_rate, 0) / 100.0), 2),
  coalesce(i.currency, 'GBP'),
  case when i.stripe_payment_intent_id is not null then 'stripe' else 'bank_transfer' end,
  'Backfilled from paid_at on migration'
from invoices i
where i.status = 'paid'
  and i.deleted_at is null
  and not exists (select 1 from invoice_payments p where p.invoice_id = i.id);
