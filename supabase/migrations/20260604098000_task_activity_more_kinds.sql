-- ============================================================================
-- Extend the engagement_tasks activity trigger to log title / description /
-- priority / labels changes too (brief 4 logged only status / assignee /
-- due_date). Trigger stays SECURITY DEFINER and fires in the mutation's txn, so
-- the audit feed stays atomic. Description payload omits the text (just records
-- that it changed) to keep activity rows small.
-- ============================================================================

create or replace function log_engagement_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
    values (new.id, auth.uid(), 'created', jsonb_build_object('title', new.title));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.assignee_person_id is distinct from old.assignee_person_id then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'assigned', jsonb_build_object('from', old.assignee_person_id, 'to', new.assignee_person_id));
    end if;
    if new.due_date is distinct from old.due_date then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'due_date_changed', jsonb_build_object('from', old.due_date, 'to', new.due_date));
    end if;
    if new.priority is distinct from old.priority then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'priority_changed', jsonb_build_object('from', old.priority, 'to', new.priority));
    end if;
    if new.title is distinct from old.title then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'title_changed', jsonb_build_object('from', old.title, 'to', new.title));
    end if;
    if new.description is distinct from old.description then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'description_changed', '{}'::jsonb);
    end if;
    if new.labels is distinct from old.labels then
      insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
      values (new.id, auth.uid(), 'labels_changed', jsonb_build_object('from', to_jsonb(old.labels), 'to', to_jsonb(new.labels)));
    end if;
  end if;
  return null;
end $$;
