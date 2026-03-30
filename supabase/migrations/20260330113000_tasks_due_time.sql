alter table tasks
add column if not exists due_time time;

create index if not exists idx_tasks_due_schedule on tasks(due_date, due_time);
