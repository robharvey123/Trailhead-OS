-- ============================================================================
-- Link time entries to an engagement task so work can be timed from within a
-- task (start/stop on the task detail page). Additive and nullable: existing
-- project/engagement-scoped entries are unaffected. on delete set null keeps a
-- task's logged time in the timesheet even if the task is later removed.
-- ============================================================================

alter table time_entries
  add column if not exists task_id uuid references engagement_tasks(id) on delete set null;

create index if not exists idx_time_entries_task on time_entries (task_id);
