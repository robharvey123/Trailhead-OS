-- ============================================================================
-- crm_v3 — Deals / Tags / Attachments / Saved Views  (+ tasks.deal_id)
-- ----------------------------------------------------------------------------
-- Built on the OS single-tenant model (accounts / contacts / tasks), per the
-- v3 reconciliation decision. Deviations from the original v3 brief, and why:
--
--   * NO `profiles` table. Identity = auth.users(id), matching the existing
--     owner_user_id pattern (tasks, crm_deals). Single user — a parallel
--     identity table is YAGNI. owner_id / uploaded_by / saved_views.owner_id
--     therefore reference auth.users(id).
--   * NO `workspace_id`. Single-tenant; RLS = "authenticated full access",
--     matching the live OS pattern (see 20260409100000_fix_rls_*).
--   * NO new `tasks` / `contacts` / `accounts` tables — they already exist.
--     `tasks` already has account_id / contact_id / project_id / status /
--     priority / owner_user_id, so v3 only ADDS `tasks.deal_id`.
--   * Deals reference the OS `accounts`/`contacts` (the brief's `deals` table),
--     NOT the empty `crm_deals` (workspace surface, being orphaned/retired).
--   * Trigger function is `update_workspace_updated_at()` (the real one), NOT
--     the brief's non-existent `update_updated_at()`.
--   * Views use REAL status vocabularies: tasks (todo/in_progress/blocked/
--     done/cancelled), projects (planning/active/...), and account.name
--     (there is no accounts.business_name) / accounts.channel.
--   * `attachments.email_id` is forward-declared (no FK yet). The email store
--     FK is added in the Gmail/Inbox phase, which extends email_logs.
--   * `account_overview.last_email_at` is deferred to the Gmail phase.
--
-- Idempotent / rerunnable: if-not-exists + drop-if-exists throughout.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DEALS  (money-bearing pipeline, hung off OS accounts/contacts)
-- ---------------------------------------------------------------------------
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  primary_contact_id uuid references contacts(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  stage text not null default 'New'
    check (stage in ('New','Qualified','Proposal Sent','Negotiation','Won','Lost','On Hold')),
  value_amount numeric(12,2),
  value_currency text not null default 'GBP',
  probability integer not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  closed_at timestamptz,
  source text,                                   -- 'Referral','Inbound','Outbound','Existing Client', ...
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_deals_account on deals (account_id);
create index if not exists idx_deals_stage on deals (stage);
create index if not exists idx_deals_owner on deals (owner_id);
create index if not exists idx_deals_expected_close on deals (expected_close_date);

drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at before update on deals
  for each row execute function update_workspace_updated_at();

-- ---------------------------------------------------------------------------
-- TASKS — add deal link only (table already exists, fully featured)
-- ---------------------------------------------------------------------------
alter table tasks
  add column if not exists deal_id uuid references deals(id) on delete set null;
create index if not exists idx_tasks_deal on tasks (deal_id);

-- ---------------------------------------------------------------------------
-- TAGS — normalized (existing accounts.tags text[] backfilled below)
-- ---------------------------------------------------------------------------
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'accent'
    check (color in ('accent','green','amber','red','emerald','grey'))
);

create table if not exists account_tags (
  account_id uuid references accounts(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (account_id, tag_id)
);

create table if not exists deal_tags (
  deal_id uuid references deals(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (deal_id, tag_id)
);
create index if not exists idx_account_tags_tag on account_tags (tag_id);
create index if not exists idx_deal_tags_tag on deal_tags (tag_id);

-- Backfill normalized tags from the existing accounts.tags[] array (safe).
insert into tags (name)
  select distinct trim(t)
  from accounts a, unnest(a.tags) as t
  where coalesce(trim(t), '') <> ''
on conflict (name) do nothing;

insert into account_tags (account_id, tag_id)
  select a.id, tg.id
  from accounts a, unnest(a.tags) as t
  join tags tg on tg.name = trim(t)
  where coalesce(trim(t), '') <> ''
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- ATTACHMENTS  (Supabase Storage bucket: crm-attachments)
-- ---------------------------------------------------------------------------
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  email_id uuid,                                 -- forward-declared; FK added in Gmail phase
  storage_path text not null,                    -- crm-attachments/<account|unmatched>/<...>/<filename>
  filename text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attachments_account on attachments (account_id);
create index if not exists idx_attachments_deal on attachments (deal_id);
create index if not exists idx_attachments_email on attachments (email_id);

-- ---------------------------------------------------------------------------
-- SAVED VIEWS  (per-entity filter/sort presets, pinnable to the sidebar)
-- ---------------------------------------------------------------------------
create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  entity text not null check (entity in ('accounts','deals','tasks','timesheet','inbox')),
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_views_owner_entity on saved_views (owner_id, entity);

-- ---------------------------------------------------------------------------
-- RLS — authenticated full access (single-tenant OS pattern)
-- ---------------------------------------------------------------------------
alter table deals enable row level security;
alter table tags enable row level security;
alter table account_tags enable row level security;
alter table deal_tags enable row level security;
alter table attachments enable row level security;
alter table saved_views enable row level security;

drop policy if exists deals_authenticated_full_access on deals;
create policy deals_authenticated_full_access on deals for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists tags_authenticated_full_access on tags;
create policy tags_authenticated_full_access on tags for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists account_tags_authenticated_full_access on account_tags;
create policy account_tags_authenticated_full_access on account_tags for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists deal_tags_authenticated_full_access on deal_tags;
create policy deal_tags_authenticated_full_access on deal_tags for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists attachments_authenticated_full_access on attachments;
create policy attachments_authenticated_full_access on attachments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists saved_views_authenticated_full_access on saved_views;
create policy saved_views_authenticated_full_access on saved_views for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- VIEWS — pipeline + account roll-up (plain views, matching repo convention)
-- ---------------------------------------------------------------------------
drop view if exists pipeline_summary;
create view pipeline_summary as
  select
    stage,
    count(*)                                              as deal_count,
    coalesce(sum(value_amount), 0)                        as total_value,
    coalesce(sum(value_amount * probability / 100.0), 0)  as weighted_value
  from deals
  where stage not in ('Won', 'Lost')
  group by stage;

drop view if exists account_overview;
create view account_overview as
  select
    a.id,
    a.name,
    a.channel,
    a.status,
    coalesce(d.open_deal_count, 0)    as open_deal_count,
    coalesce(d.open_deal_value, 0)    as open_deal_value,
    coalesce(t.open_task_count, 0)    as open_task_count,
    coalesce(p.open_project_count, 0) as open_project_count
  from accounts a
  left join (
    select account_id,
           count(*)                       as open_deal_count,
           coalesce(sum(value_amount), 0) as open_deal_value
    from deals
    where stage not in ('Won', 'Lost', 'On Hold')
    group by account_id
  ) d on d.account_id = a.id
  left join (
    select account_id, count(*) as open_task_count
    from tasks
    where status in ('todo', 'in_progress', 'blocked')
    group by account_id
  ) t on t.account_id = a.id
  left join (
    select account_id, count(*) as open_project_count
    from projects
    where status not in ('completed', 'archived', 'cancelled')
    group by account_id
  ) p on p.account_id = a.id;
