-- Timesheet and rate support for Trailhead OS

alter table if exists accounts
  add column if not exists default_hourly_rate numeric(10,2) default 0,
  add column if not exists currency text default 'GBP';

alter table if exists projects
  add column if not exists hourly_rate numeric(10,2),
  add column if not exists currency text default 'GBP';

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  account_id uuid references accounts(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  entry_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes int not null default 0,
  description text,
  billable boolean not null default true,
  rate_snapshot numeric(10,2) default 0,
  currency_snapshot text not null default 'GBP',
  source text not null default 'manual' check (source in ('manual','timer')),
  is_running boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_entries_account_id on time_entries(account_id);
create index if not exists idx_time_entries_project_id on time_entries(project_id);
create index if not exists idx_time_entries_entry_date on time_entries(entry_date);
create index if not exists idx_time_entries_user_id on time_entries(user_id);
create unique index if not exists one_running_timer_per_user on time_entries (user_id) where is_running = true;

drop trigger if exists time_entries_updated_at on time_entries;
create trigger time_entries_updated_at
  before update on time_entries
  for each row execute function update_workspace_updated_at();

alter table if exists time_entries enable row level security;

drop policy if exists "authenticated full access" on time_entries;
create policy "authenticated full access" on time_entries
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create or replace view project_time_totals as
select
  p.id as project_id,
  p.account_id as account_id,
  p.name as project_name,
  p.status as project_status,
  coalesce(sum(te.duration_minutes), 0) as total_minutes,
  coalesce(sum(case when te.billable then te.duration_minutes else 0 end), 0) as billable_minutes,
  coalesce(sum(case when te.billable then (te.duration_minutes/60.0) * coalesce(te.rate_snapshot, 0) else 0 end), 0) as billable_amount,
  max(te.entry_date) as last_entry_date
from projects p
left join time_entries te on te.project_id = p.id and te.is_running = false
group by p.id;

create or replace view account_time_totals as
select
  a.id as account_id,
  a.name as business_name,
  coalesce(sum(te.duration_minutes), 0) as total_minutes,
  coalesce(sum(case when te.billable then te.duration_minutes else 0 end), 0) as billable_minutes,
  coalesce(sum(case when te.billable then (te.duration_minutes/60.0) * coalesce(te.rate_snapshot, 0) else 0 end), 0) as billable_amount
from accounts a
left join time_entries te on te.account_id = a.id and te.is_running = false
group by a.id;