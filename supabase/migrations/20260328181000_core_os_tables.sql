-- Core OS tables for Trailhead OS Phase 1

create table if not exists workstreams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  label text not null,
  colour text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

insert into workstreams (slug, label, colour, sort_order)
values
  ('brand-sales', 'Brand sales', 'teal', 1),
  ('ecommerce', 'eBay & Amazon', 'amber', 2),
  ('app-dev', 'App development', 'purple', 3),
  ('mvp-cricket', 'MVP Cricket', 'green', 4),
  ('consulting', 'Consulting', 'coral', 5)
on conflict (slug) do update
set
  label = excluded.label,
  colour = excluded.colour,
  sort_order = excluded.sort_order;

create table if not exists board_columns (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid not null references workstreams(id) on delete cascade,
  label text not null,
  sort_order int default 0
);

insert into board_columns (workstream_id, label, sort_order)
select w.id, col.label, col.sort_order
from workstreams w
cross join (
  values
    ('Backlog', 0),
    ('In progress', 1),
    ('Review', 2),
    ('Done', 3)
) as col(label, sort_order)
where not exists (
  select 1
  from board_columns bc
  where bc.workstream_id = w.id
    and bc.label = col.label
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete cascade,
  column_id uuid references board_columns(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high', 'urgent')) default 'medium',
  due_date date,
  is_master_todo boolean default false,
  tags text[] default '{}',
  sort_order int default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  workstream_id uuid references workstreams(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  title text,
  body text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_board_columns_workstream on board_columns(workstream_id, sort_order);
create index if not exists idx_tasks_workstream on tasks(workstream_id, sort_order);
create index if not exists idx_tasks_column on tasks(column_id, sort_order);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_completed_at on tasks(completed_at);
create index if not exists idx_notes_workstream on notes(workstream_id, updated_at desc);
create index if not exists idx_notes_task on notes(task_id, updated_at desc);

alter table workstreams enable row level security;
alter table board_columns enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;

drop policy if exists workstreams_authenticated_full_access on workstreams;
create policy workstreams_authenticated_full_access
  on workstreams for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists board_columns_authenticated_full_access on board_columns;
create policy board_columns_authenticated_full_access
  on board_columns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists tasks_authenticated_full_access on tasks;
create policy tasks_authenticated_full_access
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists notes_authenticated_full_access on notes;
create policy notes_authenticated_full_access
  on notes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists tasks_updated_at on tasks;
create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_workspace_updated_at();

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute function update_workspace_updated_at();
