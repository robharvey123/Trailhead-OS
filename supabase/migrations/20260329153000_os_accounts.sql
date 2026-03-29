create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  size text check (size in (
    '1-10','11-50','51-200','201-500','500+'
  )),
  workstream_id uuid references workstreams(id) on delete set null,
  status text default 'prospect' check (status in (
    'prospect','active','inactive','archived'
  )),
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  country text default 'UK',
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table accounts enable row level security;

drop policy if exists "authenticated full access" on accounts;
create policy "authenticated full access" on accounts
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table contacts
  add column if not exists account_id uuid
  references accounts(id) on delete set null;

alter table tasks
  add column if not exists account_id uuid
  references accounts(id) on delete set null;

alter table tasks
  add column if not exists contact_id uuid
  references contacts(id) on delete set null;

alter table enquiries
  add column if not exists account_id uuid
  references accounts(id) on delete set null;

create index if not exists idx_accounts_workstream_id on accounts(workstream_id);
create index if not exists idx_accounts_status on accounts(status);
create index if not exists idx_accounts_name on accounts(name);
create index if not exists idx_contacts_account_id on contacts(account_id);
create index if not exists idx_tasks_account_id on tasks(account_id);
create index if not exists idx_enquiries_account_id on enquiries(account_id);

drop trigger if exists accounts_updated_at on accounts;
create trigger accounts_updated_at
  before update on accounts
  for each row execute function update_workspace_updated_at();
