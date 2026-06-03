-- ============================================================================
-- Brief 4 — Engagement tasks / ticket board.
--
-- NAMING (agreed with Rob): a `tasks` table and a `task_activity` table ALREADY
-- exist (workstream/project-management system). To avoid collision this brief
-- lives in its own namespace: engagement_tasks / engagement_task_comments /
-- engagement_task_activity / engagement_task_read_state, with enums
-- engagement_task_status / engagement_task_priority.
--
-- DESIGN NOTE (improves on the brief): activity logging is done by AFTER
-- triggers, not by the server action inserting a second row. A trigger runs in
-- the SAME transaction as the mutation, so an activity row can never be orphaned
-- by a partial failure (the brief's explicit concern). The trigger fns are
-- SECURITY DEFINER so they can write engagement_task_activity, which has no
-- user-facing INSERT policy (activity is read-only to users).
--
-- Uses the real helpers from brief 3 (is_admin, current_person_id) and the real
-- updated_at fn (update_workspace_updated_at). `position` is numeric to support
-- the float-midpoint reorder trick (the brief's `integer` contradicts its own
-- algorithm).
-- ============================================================================

do $$ begin
  create type engagement_task_status as enum ('backlog', 'in_progress', 'review', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type engagement_task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

create table if not exists engagement_tasks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references engagements(id) on delete cascade,
  title text not null,
  description text,
  status engagement_task_status not null default 'backlog',
  priority engagement_task_priority not null default 'normal',
  assignee_person_id uuid references people(id) on delete set null,
  reporter_person_id uuid references people(id) on delete set null,
  due_date date,
  labels text[] not null default '{}',
  position numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_eng_tasks_assignee_open on engagement_tasks (assignee_person_id) where status not in ('done', 'cancelled');
create index if not exists idx_eng_tasks_reporter on engagement_tasks (reporter_person_id);
create index if not exists idx_eng_tasks_board on engagement_tasks (engagement_id, status, position);
create index if not exists idx_eng_tasks_due_open on engagement_tasks (status, due_date) where status not in ('done', 'cancelled');

drop trigger if exists engagement_tasks_updated_at on engagement_tasks;
create trigger engagement_tasks_updated_at
  before update on engagement_tasks
  for each row execute function update_workspace_updated_at();

-- Auto-manage completed_at on status transitions.
create or replace function engagement_tasks_set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end $$;
drop trigger if exists engagement_tasks_completed_at on engagement_tasks;
create trigger engagement_tasks_completed_at
  before update on engagement_tasks
  for each row execute function engagement_tasks_set_completed_at();

create table if not exists engagement_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references engagement_tasks(id) on delete cascade,
  author_person_id uuid references people(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_eng_task_comments_task on engagement_task_comments (task_id, created_at);

drop trigger if exists engagement_task_comments_updated_at on engagement_task_comments;
create trigger engagement_task_comments_updated_at
  before update on engagement_task_comments
  for each row execute function update_workspace_updated_at();

create table if not exists engagement_task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references engagement_tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind text not null,           -- 'created' | 'assigned' | 'status_changed' | 'commented' | 'due_date_changed'
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_eng_task_activity_task on engagement_task_activity (task_id, created_at);

-- Per-person unread cursor.
create table if not exists engagement_task_read_state (
  person_id uuid not null references people(id) on delete cascade,
  task_id uuid not null references engagement_tasks(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (person_id, task_id)
);

-- ---------------------------------------------------------------------------
-- ACTIVITY LOGGING (atomic, via triggers). SECURITY DEFINER so the insert into
-- engagement_task_activity bypasses RLS (no user INSERT policy exists).
-- actor_user_id = auth.uid() (JWT claim, unaffected by SECURITY DEFINER).
-- ---------------------------------------------------------------------------
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
  end if;
  return null;
end $$;
drop trigger if exists engagement_tasks_activity on engagement_tasks;
create trigger engagement_tasks_activity
  after insert or update on engagement_tasks
  for each row execute function log_engagement_task_activity();

create or replace function log_engagement_task_comment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into engagement_task_activity (task_id, actor_user_id, kind, payload)
  values (new.task_id, auth.uid(), 'commented', jsonb_build_object('comment_id', new.id));
  return null;
end $$;
drop trigger if exists engagement_task_comments_activity on engagement_task_comments;
create trigger engagement_task_comments_activity
  after insert on engagement_task_comments
  for each row execute function log_engagement_task_comment_activity();

-- ---------------------------------------------------------------------------
-- is_on_engagement — current person is an active contributor on the engagement.
-- SECURITY DEFINER + pinned search_path, matching the other brief-3 helpers.
-- ---------------------------------------------------------------------------
create or replace function is_on_engagement(p_engagement_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_engagement_id is not null and exists (
    select 1 from engagement_contributors ec
    where ec.engagement_id = p_engagement_id
      and ec.person_id = current_person_id()
      and ec.is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table engagement_tasks enable row level security;
alter table engagement_task_comments enable row level security;
alter table engagement_task_activity enable row level security;
alter table engagement_task_read_state enable row level security;

-- Tasks: admin all; otherwise assignee, reporter, or on the engagement.
drop policy if exists engagement_tasks_select on engagement_tasks;
create policy engagement_tasks_select on engagement_tasks for select using (
  is_admin()
  or assignee_person_id = current_person_id()
  or reporter_person_id = current_person_id()
  or is_on_engagement(engagement_id)
);
drop policy if exists engagement_tasks_insert on engagement_tasks;
create policy engagement_tasks_insert on engagement_tasks for insert with check (
  is_admin() or reporter_person_id = current_person_id()
);
drop policy if exists engagement_tasks_update on engagement_tasks;
create policy engagement_tasks_update on engagement_tasks for update using (
  is_admin() or assignee_person_id = current_person_id() or reporter_person_id = current_person_id()
) with check (
  is_admin() or assignee_person_id = current_person_id() or reporter_person_id = current_person_id()
);
drop policy if exists engagement_tasks_delete on engagement_tasks;
create policy engagement_tasks_delete on engagement_tasks for delete using (
  is_admin() or reporter_person_id = current_person_id()
);

-- Comments inherit task visibility (the subselect is itself RLS-filtered).
drop policy if exists engagement_task_comments_select on engagement_task_comments;
create policy engagement_task_comments_select on engagement_task_comments for select using (
  exists (select 1 from engagement_tasks t where t.id = task_id)
);
drop policy if exists engagement_task_comments_insert on engagement_task_comments;
create policy engagement_task_comments_insert on engagement_task_comments for insert with check (
  author_person_id = current_person_id()
  and exists (select 1 from engagement_tasks t where t.id = task_id)
);
drop policy if exists engagement_task_comments_update on engagement_task_comments;
create policy engagement_task_comments_update on engagement_task_comments for update using (
  author_person_id = current_person_id()
) with check (author_person_id = current_person_id());
drop policy if exists engagement_task_comments_delete on engagement_task_comments;
create policy engagement_task_comments_delete on engagement_task_comments for delete using (
  is_admin() or author_person_id = current_person_id()
);

-- Activity: read-only to users (writes are via the SECURITY DEFINER triggers).
drop policy if exists engagement_task_activity_select on engagement_task_activity;
create policy engagement_task_activity_select on engagement_task_activity for select using (
  exists (select 1 from engagement_tasks t where t.id = task_id)
);

-- Read state: each person manages only their own cursor.
drop policy if exists engagement_task_read_state_self on engagement_task_read_state;
create policy engagement_task_read_state_self on engagement_task_read_state for all
  using (person_id = current_person_id())
  with check (person_id = current_person_id());
