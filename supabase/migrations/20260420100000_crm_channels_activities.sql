-- CRM enhancements: add channel/source fields to accounts, new account statuses, activities table

-- 1. Add new columns to accounts
alter table accounts add column if not exists channel text;
alter table accounts add column if not exists source text;
alter table accounts add column if not exists email_contact text;
alter table accounts add column if not exists hq_address text;

-- 2. Widen the status check constraint to include new CRM statuses
-- Drop the existing check constraint (named from the original migration)
alter table accounts drop constraint if exists accounts_status_check;
alter table accounts add constraint accounts_status_check
  check (status in (
    'prospect', 'contacted', 'active', 'listed', 'declined', 'on_hold',
    'inactive', 'archived'
  ));

-- 3. Add indexes for new columns
create index if not exists idx_accounts_channel on accounts(channel);
create index if not exists idx_accounts_lower_name on accounts(lower(name));

-- 4. Activities table
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  type text not null check (type in ('Email','Call','Meeting','Note','Task')),
  subject text,
  notes text,
  activity_date date not null default current_date,
  next_action text,
  next_action_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_activities_account_id on activities(account_id);
create index if not exists idx_activities_activity_date on activities(activity_date);

-- 5. RLS on activities
alter table activities enable row level security;

drop policy if exists "authenticated full access" on activities;
create policy "authenticated full access" on activities
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
