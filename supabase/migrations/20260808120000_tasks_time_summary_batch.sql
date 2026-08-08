-- ============================================================================
-- Batch variant of task_time_summary(): total logged minutes for MANY delivery
-- tickets at once, for the engagement task board's per-card rollup. Like the
-- single-task function it is SECURITY DEFINER so the board reflects EVERYONE's
-- logged time (time_entries is own-scoped via RLS) rather than only the viewer's.
-- Exposes minute totals per task_id only — no entry detail, descriptions, or rates.
-- ============================================================================

create or replace function tasks_time_summary(p_task_ids uuid[])
returns table (task_id uuid, minutes bigint, billable_minutes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    te.task_id,
    sum(te.duration_minutes)::bigint as minutes,
    coalesce(sum(te.duration_minutes) filter (where te.billable), 0)::bigint as billable_minutes
  from time_entries te
  where te.task_id = any(p_task_ids)
    and te.is_running = false
    and te.duration_minutes > 0
  group by te.task_id;
$$;

revoke all on function tasks_time_summary(uuid[]) from public;
grant execute on function tasks_time_summary(uuid[]) to authenticated;
