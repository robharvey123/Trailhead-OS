-- CRM and enquiries tables for Trailhead OS Phase 2

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete set null,
  name text not null,
  company text,
  email text,
  phone text,
  role text,
  status text default 'lead' check (status in ('lead', 'active', 'inactive', 'archived')),
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  biz_name text not null,
  contact_name text not null,
  biz_type text,
  team_size text,
  team_split text,
  top_features text[] default '{}',
  calendar_detail text,
  forms_detail text,
  devices text[] default '{}',
  offline_capability text,
  existing_tools text,
  pain_points text,
  timeline text,
  budget text,
  extra text,
  status text default 'new' check (status in ('new', 'reviewed', 'converted')),
  converted_contact_id uuid references contacts(id) on delete set null
);

alter table tasks
  add column if not exists contact_id uuid references contacts(id) on delete set null;

alter table contacts enable row level security;
alter table enquiries enable row level security;

drop policy if exists "authenticated full access" on contacts;
create policy "authenticated full access" on contacts
  for all
  using (auth.role() = 'authenticated');

drop policy if exists "public can insert enquiries" on enquiries;
create policy "public can insert enquiries" on enquiries
  for insert
  with check (true);

drop policy if exists "authenticated can read enquiries" on enquiries;
create policy "authenticated can read enquiries" on enquiries
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated can update enquiries" on enquiries;
create policy "authenticated can update enquiries" on enquiries
  for update
  using (auth.role() = 'authenticated');

create index if not exists idx_contacts_workstream_id on contacts(workstream_id);
create index if not exists idx_contacts_status on contacts(status);
create index if not exists idx_enquiries_status_created_at on enquiries(status, created_at desc);
create index if not exists idx_tasks_contact_id on tasks(contact_id);

drop trigger if exists contacts_updated_at on contacts;
create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_workspace_updated_at();
