create sequence if not exists quote_number_seq start 1;

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null
    default 'QT-' || lpad(nextval('quote_number_seq')::text, 4, '0'),
  account_id uuid references accounts(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  workstream_id uuid references workstreams(id) on delete set null,
  enquiry_id uuid references enquiries(id) on delete set null,

  status text default 'draft' check (status in (
    'draft','sent','accepted','declined','expired','converted'
  )),

  pricing_type text default 'fixed' check (pricing_type in (
    'fixed','time_and_materials','milestone'
  )),

  title text not null,
  summary text,

  scope jsonb default '[]',
  line_items jsonb default '[]',

  vat_rate numeric default 20,

  valid_until date,
  payment_terms text default 'Payment terms: 50% deposit on acceptance, 50% on completion.',
  notes text,

  converted_invoice_id uuid references invoices(id) on delete set null,

  ai_generated boolean default false,
  ai_generated_at timestamptz,

  issue_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table quotes enable row level security;

drop policy if exists "authenticated full access" on quotes;
create policy "authenticated full access" on quotes
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_quotes_status on quotes(status);
create index if not exists idx_quotes_account_id on quotes(account_id);
create index if not exists idx_quotes_contact_id on quotes(contact_id);
create index if not exists idx_quotes_workstream_id on quotes(workstream_id);
create index if not exists idx_quotes_enquiry_id on quotes(enquiry_id);
create index if not exists idx_quotes_issue_date on quotes(issue_date desc);

drop trigger if exists quotes_updated_at on quotes;
create trigger quotes_updated_at
  before update on quotes
  for each row execute function update_workspace_updated_at();
