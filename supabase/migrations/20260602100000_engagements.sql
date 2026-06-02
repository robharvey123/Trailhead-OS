-- ============================================================================
-- v4 — Engagements (retainer contracts), Tier-1 milestones, workstreams on time.
-- Built on the OS single-tenant model. No workspace_id. RLS = authenticated
-- full access (matching the rest of the OS schema). Additive only.
--
-- NOTE (deviation from brief): the tier1 completion trigger computes completion
-- from the three date columns directly, NOT from new.is_complete. is_complete is
-- a STORED generated column, which Postgres computes AFTER before-triggers — so
-- reading new.is_complete in a BEFORE trigger would see the stale value and
-- completed_at would never stamp. Trigger also handles INSERT and un-completion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENGAGEMENTS
-- ---------------------------------------------------------------------------
create table if not exists engagements (
  id uuid primary key default gen_random_uuid(),
  end_client_account_id uuid not null references accounts(id) on delete restrict,
  billed_via_account_id uuid references accounts(id) on delete set null,
  name text not null,
  code text,
  status text not null default 'Active'
    check (status in ('Draft','Active','Paused','Completed','Terminated')),
  currency text not null default 'GBP',
  retainer_amount_monthly numeric(10,2),
  included_hours_monthly integer,
  day_rate numeric(10,2),
  performance_fee_default numeric(10,2),
  start_date date not null,
  end_date date,
  workstreams text[] not null default '{}',
  approval_thresholds jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_engagements_end_client on engagements (end_client_account_id);
create index if not exists idx_engagements_status on engagements (status);

-- ---------------------------------------------------------------------------
-- ENGAGEMENT TIER-1 ACCOUNTS
-- ---------------------------------------------------------------------------
create table if not exists engagement_tier1_accounts (
  engagement_id uuid references engagements(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  notes text,
  primary key (engagement_id, account_id)
);

-- ---------------------------------------------------------------------------
-- TIER-1 MILESTONES (three-condition tracker)
-- ---------------------------------------------------------------------------
create table if not exists tier1_milestones (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  range_review_decided_at date,
  go_live_confirmed_at date,
  first_po_received_at date,
  is_complete boolean generated always as (
    range_review_decided_at is not null
    and go_live_confirmed_at is not null
    and first_po_received_at is not null
  ) stored,
  completed_at timestamptz,
  performance_fee numeric(10,2),
  fee_invoice_id uuid references invoices(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, account_id)
);
create index if not exists idx_tier1_milestones_engagement on tier1_milestones (engagement_id);
create index if not exists idx_tier1_milestones_complete on tier1_milestones (is_complete);

-- Stamp completed_at when the three dates are all set (computed from the date
-- columns, not the generated is_complete column). Clears it if a date is removed.
create or replace function stamp_tier1_completion()
returns trigger language plpgsql as $$
declare
  now_complete boolean := (
    new.range_review_decided_at is not null
    and new.go_live_confirmed_at is not null
    and new.first_po_received_at is not null
  );
  was_complete boolean := (
    tg_op = 'UPDATE'
    and old.range_review_decided_at is not null
    and old.go_live_confirmed_at is not null
    and old.first_po_received_at is not null
  );
begin
  if now_complete and not was_complete then
    new.completed_at = now();
  elsif not now_complete then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
drop trigger if exists tier1_completion_stamp on tier1_milestones;
create trigger tier1_completion_stamp
  before insert or update on tier1_milestones
  for each row execute function stamp_tier1_completion();

-- ---------------------------------------------------------------------------
-- LINKS: projects + time_entries -> engagement, workstream on time
-- ---------------------------------------------------------------------------
alter table projects add column if not exists engagement_id uuid references engagements(id) on delete set null;
create index if not exists idx_projects_engagement on projects (engagement_id);

alter table time_entries add column if not exists workstream text;
alter table time_entries add column if not exists engagement_id uuid references engagements(id) on delete set null;
create index if not exists idx_time_entries_engagement on time_entries (engagement_id);
create index if not exists idx_time_entries_workstream on time_entries (workstream);

-- ---------------------------------------------------------------------------
-- VIEWS
-- ---------------------------------------------------------------------------
drop view if exists engagement_hours_by_month;
create view engagement_hours_by_month as
select
  e.id                                                                        as engagement_id,
  date_trunc('month', te.entry_date)::date                                    as period_month,
  coalesce(sum(te.duration_minutes), 0) / 60.0                                 as hours_used,
  e.included_hours_monthly                                                     as hours_included,
  coalesce(sum(te.duration_minutes), 0) / 60.0 - coalesce(e.included_hours_monthly, 0) as hours_over,
  coalesce(sum(case when te.billable then te.duration_minutes else 0 end), 0) / 60.0   as billable_hours
from engagements e
left join time_entries te
  on te.engagement_id = e.id and te.is_running = false
group by e.id, date_trunc('month', te.entry_date), e.included_hours_monthly;

drop view if exists engagement_workstream_split;
create view engagement_workstream_split as
select
  e.id                                                                        as engagement_id,
  date_trunc('month', te.entry_date)::date                                    as period_month,
  coalesce(te.workstream, 'Unspecified')                                      as workstream,
  coalesce(sum(te.duration_minutes), 0) / 60.0                                 as hours
from engagements e
left join time_entries te
  on te.engagement_id = e.id and te.is_running = false
where te.id is not null
group by e.id, date_trunc('month', te.entry_date), te.workstream;

drop view if exists tier1_milestone_summary;
create view tier1_milestone_summary as
select
  m.engagement_id,
  count(*)                                                                                            as total_tracked,
  count(*) filter (where m.is_complete)                                                               as completed,
  count(*) filter (where not m.is_complete)                                                           as in_progress,
  coalesce(sum(m.performance_fee) filter (where m.is_complete and m.fee_invoice_id is null), 0)       as billable_not_invoiced,
  coalesce(sum(m.performance_fee) filter (where m.is_complete and m.fee_invoice_id is not null), 0)   as invoiced
from tier1_milestones m
group by m.engagement_id;

-- ---------------------------------------------------------------------------
-- RLS — authenticated full access (OS pattern)
-- ---------------------------------------------------------------------------
alter table engagements enable row level security;
alter table engagement_tier1_accounts enable row level security;
alter table tier1_milestones enable row level security;

drop policy if exists engagements_authenticated_full_access on engagements;
create policy engagements_authenticated_full_access on engagements for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists engagement_tier1_accounts_authenticated_full_access on engagement_tier1_accounts;
create policy engagement_tier1_accounts_authenticated_full_access on engagement_tier1_accounts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists tier1_milestones_authenticated_full_access on tier1_milestones;
create policy tier1_milestones_authenticated_full_access on tier1_milestones for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists engagements_updated_at on engagements;
create trigger engagements_updated_at before update on engagements
  for each row execute function update_workspace_updated_at();

drop trigger if exists tier1_milestones_updated_at on tier1_milestones;
create trigger tier1_milestones_updated_at before update on tier1_milestones
  for each row execute function update_workspace_updated_at();
