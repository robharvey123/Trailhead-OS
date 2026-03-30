create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references workstreams(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  pricing_tier_id uuid references pricing_tiers(id) on delete set null,
  name text not null,
  description text,
  brief text,
  status text not null default 'planning'
    check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date date default current_date,
  end_date date,
  estimated_end_date date,
  ai_planned boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  sort_order int not null default 0,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  date date not null,
  completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks
  add column if not exists start_date date,
  add column if not exists phase_id uuid references project_phases(id) on delete set null,
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_tasks_project_id on tasks(project_id);
create index if not exists idx_tasks_phase_id on tasks(phase_id);
create index if not exists idx_tasks_start_date on tasks(start_date);
create index if not exists idx_projects_workstream_id on projects(workstream_id);
create index if not exists idx_projects_account_id on projects(account_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_project_phases_project_id on project_phases(project_id);
create index if not exists idx_project_milestones_project_id on project_milestones(project_id);
create index if not exists idx_project_milestones_date on project_milestones(date);

alter table projects enable row level security;
alter table project_phases enable row level security;
alter table project_milestones enable row level security;

drop policy if exists "authenticated full access" on projects;
create policy "authenticated full access" on projects
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on project_phases;
create policy "authenticated full access" on project_phases
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on project_milestones;
create policy "authenticated full access" on project_milestones
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function update_workspace_updated_at();

drop trigger if exists project_phases_updated_at on project_phases;
create trigger project_phases_updated_at
  before update on project_phases
  for each row execute function update_workspace_updated_at();

drop trigger if exists project_milestones_updated_at on project_milestones;
create trigger project_milestones_updated_at
  before update on project_milestones
  for each row execute function update_workspace_updated_at();
