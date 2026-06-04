-- ============================================================================
-- Aggregate time-logged summary for a task, INDEPENDENT of the caller's RLS.
--
-- time_entries is own-scoped (auth.uid() = user_id) so a direct query only sees
-- the viewer's own entries. The task detail page shows an itemized list from
-- that own-scoped query, but the headline "Total / per-person" must reflect
-- EVERYONE's logged time — otherwise a non-admin sees "Total 6h" when 12.5h
-- exists. SECURITY DEFINER runs as the function owner (superuser) and bypasses
-- RLS, returning the true per-person aggregate. It only exposes minute totals
-- per person for one task — no entry detail, descriptions, or rates.
-- ============================================================================

create or replace function task_time_summary(p_task_id uuid)
returns table (person_id uuid, full_name text, minutes bigint, billable_minutes bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    te.person_id,
    coalesce(p.full_name, 'Unattributed') as full_name,
    sum(te.duration_minutes)::bigint as minutes,
    coalesce(sum(te.duration_minutes) filter (where te.billable), 0)::bigint as billable_minutes
  from time_entries te
  left join people p on p.id = te.person_id
  where te.task_id = p_task_id
    and te.is_running = false
    and te.duration_minutes > 0
  group by te.person_id, p.full_name
  order by sum(te.duration_minutes) desc;
$$;

-- Only signed-in users may call it (not the anon role).
revoke all on function task_time_summary(uuid) from public;
grant execute on function task_time_summary(uuid) to authenticated;
