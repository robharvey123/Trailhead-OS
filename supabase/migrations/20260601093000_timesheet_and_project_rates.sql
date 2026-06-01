-- Add hourly rate and currency fields to accounts
alter table if exists accounts
  add column if not exists default_hourly_rate numeric(10, 2),
  add column if not exists currency text default 'GBP';

-- Add hourly rate and currency fields to projects
alter table if exists projects
  add column if not exists hourly_rate numeric(10, 2),
  add column if not exists currency text default 'GBP';

-- Create time_entries table for timesheet tracking
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  entry_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes int not null check (duration_minutes >= 0),
  description text,
  billable boolean default true,
  rate_snapshot numeric(10, 2) default 0,
  currency_snapshot text default 'GBP',
  source text not null check (source in ('manual', 'timer')) default 'manual',
  is_running boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Unique index: only one running timer per user at a time
create unique index if not exists idx_time_entries_running_timer on time_entries(user_id) where is_running = true;

-- Indexes for common queries
create index if not exists idx_time_entries_user_date on time_entries(user_id, entry_date);
create index if not exists idx_time_entries_account on time_entries(account_id);
create index if not exists idx_time_entries_project on time_entries(project_id);
create index if not exists idx_time_entries_billable on time_entries(billable) where billable = true;

-- Create views for time totals
drop view if exists project_totals;
create view project_totals as
  select
    te.project_id,
    p.account_id,
    p.name as project_name,
    p.status as project_status,
    coalesce(sum(te.duration_minutes), 0) as total_minutes,
    coalesce(sum(case when te.billable then te.duration_minutes else 0 end), 0) as billable_minutes,
    round(coalesce(sum(case when te.billable then (te.duration_minutes::numeric / 60) * te.rate_snapshot else 0 end), 0)::numeric, 2) as billable_amount,
    max(te.entry_date) as last_entry_date
  from time_entries te
  left join projects p on te.project_id = p.id
  where te.is_running = false
  group by te.project_id, p.id, p.name, p.status, p.account_id;

drop view if exists account_time_totals;
create view account_time_totals as
  select
    te.account_id,
    a.name as business_name,
    coalesce(sum(te.duration_minutes), 0) as total_minutes,
    coalesce(sum(case when te.billable then te.duration_minutes else 0 end), 0) as billable_minutes,
    round(coalesce(sum(case when te.billable then (te.duration_minutes::numeric / 60) * te.rate_snapshot else 0 end), 0)::numeric, 2) as billable_amount
  from time_entries te
  left join accounts a on te.account_id = a.id
  where te.is_running = false
  group by te.account_id, a.id, a.name;

-- Enable RLS
alter table if exists time_entries enable row level security;

-- RLS Policy: Authenticated users can only see their own time entries

-- Drop any existing policies with the same names to ensure the migration is rerunnable.
drop policy if exists "authenticated can view own time entries" on time_entries;
drop policy if exists "authenticated can insert own time entries" on time_entries;
drop policy if exists "authenticated can update own time entries" on time_entries;
drop policy if exists "authenticated can delete own time entries" on time_entries;

create policy "authenticated can view own time entries"
  on time_entries for select
  using (auth.uid() = user_id);

create policy "authenticated can insert own time entries"
  on time_entries for insert
  with check (auth.uid() = user_id);

create policy "authenticated can update own time entries"
  on time_entries for update
  using (auth.uid() = user_id);

create policy "authenticated can delete own time entries"
  on time_entries for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
drop trigger if exists update_time_entries_updated_at on time_entries;
create trigger update_time_entries_updated_at before update on time_entries for each row execute function update_workspace_updated_at();
