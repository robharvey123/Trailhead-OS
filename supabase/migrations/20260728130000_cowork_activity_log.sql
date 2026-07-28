-- ============================================================================
-- Cowork activity log. Every write the Cowork API / MCP layer makes is recorded
-- here so Rob reviews a change log instead of doing data entry. Rows are written
-- fire-and-forget from the routes; a logging failure never fails the business
-- operation. Employee-level RLS, matching the rest of the OS.
-- ============================================================================

create table if not exists cowork_activity (
  id uuid primary key default gen_random_uuid(),
  action text not null,                    -- 'create' | 'update' | 'delete'
  entity text not null,                    -- 'invoice' | 'time_entry' | 'tier1_milestone' | ...
  entity_id uuid,
  entity_label text,                       -- human-readable: 'TH-0011', 'Booker — first PO'
  engagement_id uuid references engagements(id) on delete set null,
  summary text not null,                   -- one line, written for Rob not for a log parser
  payload jsonb,                           -- what was sent
  before jsonb,                            -- prior state on updates
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_cowork_activity_created on cowork_activity (created_at desc);
create index if not exists idx_cowork_activity_engagement on cowork_activity (engagement_id);

alter table cowork_activity enable row level security;
drop policy if exists cowork_activity_employee_rw on cowork_activity;
create policy cowork_activity_employee_rw on cowork_activity for all to authenticated
  using (is_employee()) with check (is_employee());
