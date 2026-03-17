-- Workspace task management tables

create table if not exists workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  scheduled_date date not null,
  planned_start_time time,
  task_color text,
  category text check (category in ('sales', 'marketing', 'operations', 'finance', 'product')),
  title text not null,
  description text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  required_people integer not null default 1 check (required_people > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'done', 'cancelled')),
  sort_order integer not null default 0,
  checklist_items jsonb not null default '[]'::jsonb,
  recurrence_cadence text check (recurrence_cadence in ('weekly', 'monthly')),
  recurrence_interval integer default 1,
  recurrence_end_date date,
  recurrence_parent_task_id uuid references workspace_tasks(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workspace_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid not null references workspace_tasks(id) on delete cascade,
  profile_id uuid not null references auth.users(id),
  assigned_by uuid references auth.users(id),
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'declined', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (task_id, profile_id)
);

create table if not exists workspace_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid not null references workspace_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references workspace_tasks(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists workspace_task_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid not null references workspace_tasks(id) on delete cascade,
  actor_profile_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists workspace_task_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  description text,
  category text check (category in ('sales', 'marketing', 'operations', 'finance', 'product')),
  planned_start_time time,
  task_color text,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  required_people integer not null default 1 check (required_people > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  checklist_items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index if not exists idx_workspace_tasks_ws on workspace_tasks(workspace_id);
create index if not exists idx_workspace_tasks_date on workspace_tasks(workspace_id, scheduled_date);
create index if not exists idx_workspace_tasks_status on workspace_tasks(workspace_id, status);
create index if not exists idx_workspace_assignments_task on workspace_assignments(task_id);
create index if not exists idx_workspace_deps_task on workspace_task_dependencies(task_id);
create index if not exists idx_workspace_activity_task on workspace_task_activity(task_id);
create index if not exists idx_workspace_templates_ws on workspace_task_templates(workspace_id);

-- Enable RLS
alter table workspace_tasks enable row level security;
alter table workspace_assignments enable row level security;
alter table workspace_task_dependencies enable row level security;
alter table workspace_task_activity enable row level security;
alter table workspace_task_templates enable row level security;

-- RLS policies (workspace-scoped via workspace_members)
create policy ws_tasks_member on workspace_tasks for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy ws_assignments_member on workspace_assignments for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy ws_deps_member on workspace_task_dependencies for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy ws_activity_member on workspace_task_activity for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy ws_templates_member on workspace_task_templates for all
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Auto-update updated_at triggers
create or replace function update_workspace_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workspace_tasks_updated_at before update on workspace_tasks
  for each row execute function update_workspace_updated_at();

create trigger workspace_assignments_updated_at before update on workspace_assignments
  for each row execute function update_workspace_updated_at();

create trigger workspace_templates_updated_at before update on workspace_task_templates
  for each row execute function update_workspace_updated_at();
