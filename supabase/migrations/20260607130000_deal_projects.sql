-- Deal ↔ Project many-to-many.
-- The `projects` table already exists (see 20260330093000_cowork_projects_and_task_dates.sql),
-- so this migration only introduces the join table. Single-tenant OS RLS model:
-- everything is gated on `auth.role() = 'authenticated'`, matching deals/accounts/projects.

create table if not exists deal_projects (
  deal_id    uuid not null references deals(id)    on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, project_id)
);

create index if not exists deal_projects_project_id_idx on deal_projects(project_id);
create index if not exists deal_projects_deal_id_idx on deal_projects(deal_id);

alter table deal_projects enable row level security;

drop policy if exists deal_projects_authenticated_full_access on deal_projects;
create policy deal_projects_authenticated_full_access on deal_projects for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
