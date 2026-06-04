-- ============================================================================
-- Brief 9 — end a project + project↔task link.
--
-- projects.status ALREADY exists as text with check (planning|active|on_hold|
-- completed|cancelled) — completed/cancelled are valid, so NO enum change. We
-- only add ended_at/ended_reason. "Ended" = status in ('completed','cancelled').
--
-- engagement_tasks gains project_id so "cancel this project's open tasks" can be
-- scoped precisely (roadmap import is the path that ties tasks to a project).
-- ============================================================================

alter table projects
  add column if not exists ended_at timestamptz,
  add column if not exists ended_reason text;

alter table engagement_tasks
  add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists idx_engagement_tasks_project on engagement_tasks (project_id);

-- ---------------------------------------------------------------------------
-- Atomic project end (+ optional task cancellation). SECURITY INVOKER so RLS
-- applies (caller is admin); both updates run in the function's single
-- transaction — never an ended project with half-cancelled tasks.
-- ---------------------------------------------------------------------------
create or replace function end_project(
  p_id uuid,
  p_outcome text,
  p_reason text,
  p_cancel_tasks boolean
) returns void language plpgsql as $$
begin
  if p_outcome not in ('completed', 'cancelled') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  update projects
    set status = p_outcome, ended_at = now(), ended_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_id;

  if p_cancel_tasks then
    update engagement_tasks
      set status = 'cancelled'
      where project_id = p_id and status not in ('done', 'cancelled');
  end if;
end $$;
