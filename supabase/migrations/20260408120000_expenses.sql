-- Expenses table
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null default current_date,
  description text not null,
  amount numeric(10,2) not null,
  currency text not null default 'GBP',
  category text not null default 'other'
    check (category in ('travel','software','equipment','meals','subscriptions','other')),
  receipt_url text,
  workstream_id uuid references workstreams(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  billable boolean not null default false,
  billed boolean not null default false,
  invoice_id uuid references invoices(id) on delete set null,
  tax_deductible boolean not null default true,
  notes text,
  user_id uuid not null references auth.users(id) on delete cascade
);

alter table expenses enable row level security;

create policy "authenticated full access" on expenses
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_expenses_date on expenses(date desc);
create index if not exists idx_expenses_workstream_id on expenses(workstream_id);
create index if not exists idx_expenses_account_id on expenses(account_id);
create index if not exists idx_expenses_project_id on expenses(project_id);
create index if not exists idx_expenses_invoice_id on expenses(invoice_id);
create index if not exists idx_expenses_category on expenses(category);
create index if not exists idx_expenses_billable on expenses(billable) where billable = true;
create index if not exists idx_expenses_billed on expenses(billed) where billed = false;

-- Receipts storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Storage policies for receipts bucket
create policy "authenticated can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "authenticated can read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "authenticated can delete receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');
