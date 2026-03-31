alter table tasks
  add column if not exists status text,
  add column if not exists owner text,
  add column if not exists estimated_hours int,
  add column if not exists actual_hours int,
  add column if not exists parent_task_id uuid references tasks(id) on delete set null,
  add column if not exists order_index int,
  add column if not exists custom_fields jsonb default '{}'::jsonb;

update tasks
set
  status = case
    when completed_at is not null then 'done'
    else coalesce(status, 'todo')
  end,
  order_index = coalesce(order_index, sort_order, 0),
  custom_fields = coalesce(custom_fields, '{}'::jsonb)
where status is null
   or order_index is null
   or custom_fields is null;

alter table tasks
  alter column status set default 'todo',
  alter column order_index set default 0,
  alter column custom_fields set default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'tasks_priority_check'
      and conrelid = 'tasks'::regclass
  ) then
    alter table tasks drop constraint tasks_priority_check;
  end if;

  alter table tasks
    add constraint tasks_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent', 'critical'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table tasks
    add constraint tasks_status_check
    check (status in ('todo', 'in_progress', 'blocked', 'done', 'cancelled'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table tasks
    add constraint tasks_estimated_hours_check
    check (estimated_hours is null or estimated_hours >= 0);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table tasks
    add constraint tasks_actual_hours_check
    check (actual_hours is null or actual_hours >= 0);
exception
  when duplicate_object then null;
end
$$;

alter table project_milestones
  add column if not exists title text,
  add column if not exists due_date date,
  add column if not exists status text,
  add column if not exists colour text,
  add column if not exists order_index int;

update project_milestones
set
  title = coalesce(title, name),
  due_date = coalesce(due_date, date),
  status = coalesce(status, case when completed then 'achieved' else 'pending' end),
  colour = coalesce(colour, '#0f766e'),
  order_index = coalesce(order_index, 0)
where title is null
   or due_date is null
   or status is null
   or colour is null
   or order_index is null;

alter table project_milestones
  alter column status set default 'pending',
  alter column colour set default '#0f766e',
  alter column order_index set default 0;

do $$
begin
  alter table project_milestones
    add constraint project_milestones_status_check
    check (status in ('pending', 'achieved', 'missed'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table project_milestones
    add constraint project_milestones_colour_check
    check (colour ~ '^#[0-9A-Fa-f]{6}$');
exception
  when duplicate_object then null;
end
$$;

alter table projects
  add column if not exists title text,
  add column if not exists colour text,
  add column if not exists owner text;

update projects
set
  title = coalesce(title, name),
  colour = coalesce(colour, '#0f766e')
where title is null
   or colour is null;

alter table projects
  alter column colour set default '#0f766e';

do $$
begin
  alter table projects
    add constraint projects_colour_check
    check (colour is null or colour ~ '^#[0-9A-Fa-f]{6}$');
exception
  when duplicate_object then null;
end
$$;

create or replace function sync_project_management_legacy_fields()
returns trigger
language plpgsql
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := new.name;
  end if;

  if new.name is null or btrim(new.name) = '' then
    new.name := new.title;
  end if;

  if tg_op = 'UPDATE' then
    if new.title is distinct from old.title and (new.name is null or new.name = old.name) then
      new.name := new.title;
    elsif new.name is distinct from old.name and (new.title is null or new.title = old.title) then
      new.title := new.name;
    end if;
  end if;

  if new.title is null then
    new.title := new.name;
  end if;

  if new.name is null then
    new.name := new.title;
  end if;

  if new.title is null or btrim(new.title) = '' then
    raise exception 'Project title cannot be empty';
  end if;

  return new;
end;
$$;

create or replace function sync_task_project_management_fields()
returns trigger
language plpgsql
as $$
begin
  if new.status is null then
    new.status := case when new.completed_at is not null then 'done' else 'todo' end;
  end if;

  if new.order_index is null then
    new.order_index := coalesce(new.sort_order, 0);
  end if;

  if new.sort_order is null then
    new.sort_order := coalesce(new.order_index, 0);
  end if;

  if tg_op = 'UPDATE' then
    if new.order_index is distinct from old.order_index then
      new.sort_order := new.order_index;
    elsif new.sort_order is distinct from old.sort_order then
      new.order_index := new.sort_order;
    end if;

    if new.status is distinct from old.status then
      if new.status = 'done' and new.completed_at is null then
        new.completed_at := now();
      elsif new.status <> 'done' then
        new.completed_at := null;
      end if;
    elsif new.completed_at is distinct from old.completed_at then
      new.status := case when new.completed_at is not null then 'done' else coalesce(old.status, 'todo') end;
    end if;
  else
    if new.completed_at is not null and new.status = 'todo' then
      new.status := 'done';
    end if;
  end if;

  new.custom_fields := coalesce(new.custom_fields, '{}'::jsonb);

  return new;
end;
$$;

create or replace function sync_project_milestone_legacy_fields()
returns trigger
language plpgsql
as $$
begin
  if new.title is null or btrim(new.title) = '' then
    new.title := new.name;
  end if;

  if new.name is null or btrim(new.name) = '' then
    new.name := new.title;
  end if;

  if tg_op = 'UPDATE' then
    if new.title is distinct from old.title and (new.name is null or new.name = old.name) then
      new.name := new.title;
    elsif new.name is distinct from old.name and (new.title is null or new.title = old.title) then
      new.title := new.name;
    end if;
  end if;

  if new.due_date is null then
    new.due_date := new.date;
  end if;

  if new.date is null then
    new.date := new.due_date;
  end if;

  if tg_op = 'UPDATE' then
    if new.due_date is distinct from old.due_date and (new.date is null or new.date = old.date) then
      new.date := new.due_date;
    elsif new.date is distinct from old.date and (new.due_date is null or new.due_date = old.due_date) then
      new.due_date := new.date;
    end if;
  end if;

  if new.status is null then
    new.status := case when coalesce(new.completed, false) then 'achieved' else 'pending' end;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.completed := new.status = 'achieved';
    elsif new.completed is distinct from old.completed then
      new.status := case when new.completed then 'achieved' else coalesce(old.status, 'pending') end;
    end if;
  else
    new.completed := new.status = 'achieved';
  end if;

  if new.colour is null then
    new.colour := '#0f766e';
  end if;

  if new.order_index is null then
    new.order_index := 0;
  end if;

  if new.title is null or btrim(new.title) = '' then
    raise exception 'Milestone title cannot be empty';
  end if;

  if new.due_date is null then
    raise exception 'Milestone due_date cannot be empty';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_pm_sync on projects;
create trigger projects_pm_sync
  before insert or update on projects
  for each row execute function sync_project_management_legacy_fields();

drop trigger if exists tasks_pm_sync on tasks;
create trigger tasks_pm_sync
  before insert or update on tasks
  for each row execute function sync_task_project_management_fields();

drop trigger if exists project_milestones_pm_sync on project_milestones;
create trigger project_milestones_pm_sync
  before insert or update on project_milestones
  for each row execute function sync_project_milestone_legacy_fields();

create table if not exists task_checklists (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  is_complete boolean default false,
  order_index int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_time_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  description text,
  hours decimal(6,2) not null,
  logged_date date not null,
  logged_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  type text,
  content text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table task_checklists
  add column if not exists updated_at timestamptz default now();

alter table task_attachments
  add column if not exists updated_at timestamptz default now();

alter table task_time_logs
  add column if not exists updated_at timestamptz default now();

alter table task_activity
  add column if not exists updated_at timestamptz default now();

alter table task_dependencies
  add column if not exists updated_at timestamptz default now();

do $$
begin
  alter table task_activity
    add constraint task_activity_type_check
    check (type in ('comment', 'status_change', 'assignment', 'priority_change', 'field_update'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table task_time_logs
    add constraint task_time_logs_hours_check
    check (hours > 0);
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table task_dependencies
    add constraint task_dependencies_type_check
    check (type in ('blocks', 'blocked_by'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table task_dependencies
    add constraint task_dependencies_distinct_tasks_check
    check (task_id <> depends_on_task_id);
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists idx_task_dependencies_unique
  on task_dependencies(task_id, depends_on_task_id, type);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_owner on tasks(owner);
create index if not exists idx_tasks_parent_task on tasks(parent_task_id);
create index if not exists idx_tasks_order_index on tasks(project_id, status, order_index);
create index if not exists idx_project_milestones_due_date on project_milestones(project_id, due_date);
create index if not exists idx_projects_title on projects(title);
create index if not exists idx_task_checklists_task on task_checklists(task_id, order_index);
create index if not exists idx_task_attachments_task on task_attachments(task_id, created_at desc);
create index if not exists idx_task_time_logs_task on task_time_logs(task_id, logged_date desc);
create index if not exists idx_task_activity_task on task_activity(task_id, created_at desc);
create index if not exists idx_task_dependencies_task on task_dependencies(task_id);
create index if not exists idx_task_dependencies_depends_on on task_dependencies(depends_on_task_id);

alter table task_checklists enable row level security;
alter table task_attachments enable row level security;
alter table task_time_logs enable row level security;
alter table task_activity enable row level security;
alter table task_dependencies enable row level security;

drop policy if exists "authenticated full access" on task_checklists;
create policy "authenticated full access" on task_checklists
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on task_attachments;
create policy "authenticated full access" on task_attachments
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on task_time_logs;
create policy "authenticated full access" on task_time_logs
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on task_activity;
create policy "authenticated full access" on task_activity
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "authenticated full access" on task_dependencies;
create policy "authenticated full access" on task_dependencies
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists task_checklists_updated_at on task_checklists;
create trigger task_checklists_updated_at
  before update on task_checklists
  for each row execute function update_workspace_updated_at();

drop trigger if exists task_attachments_updated_at on task_attachments;
create trigger task_attachments_updated_at
  before update on task_attachments
  for each row execute function update_workspace_updated_at();

drop trigger if exists task_time_logs_updated_at on task_time_logs;
create trigger task_time_logs_updated_at
  before update on task_time_logs
  for each row execute function update_workspace_updated_at();

drop trigger if exists task_activity_updated_at on task_activity;
create trigger task_activity_updated_at
  before update on task_activity
  for each row execute function update_workspace_updated_at();

drop trigger if exists task_dependencies_updated_at on task_dependencies;
create trigger task_dependencies_updated_at
  before update on task_dependencies
  for each row execute function update_workspace_updated_at();