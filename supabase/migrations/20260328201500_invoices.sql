create sequence invoice_number_seq start 1;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null
    default 'TH-' || lpad(nextval('invoice_number_seq')::text, 4, '0'),
  contact_id uuid references contacts(id) on delete set null,
  workstream_id uuid references workstreams(id) on delete set null,
  status text default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date,
  line_items jsonb not null default '[]',
  vat_rate numeric not null default 20,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table invoices enable row level security;

create policy "authenticated full access" on invoices
  for all using (auth.role() = 'authenticated');
