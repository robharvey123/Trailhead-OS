-- Daily Brief ownership backfill
--
-- Use this script when your Supabase project has more than one auth user and the
-- automatic single-user backfill in 20260402113000_daily_brief_ownership.sql does not apply.
--
-- Replace the placeholder email below with the authenticated OS user's email.
--
-- This script is intentionally self-contained. It will add the ownership columns
-- first if they do not already exist.

begin;

-- 0. Ensure the ownership columns exist before backfilling data.
alter table tasks
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

alter table calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_tasks_owner_user_id on tasks(owner_user_id);
create index if not exists idx_calendar_events_user_id on calendar_events(user_id);

do $$
declare
  target_email text := 'robharvey123@gmail.com';
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No auth user found for email %', target_email;
  end if;

  -- 1. Backfill task ownership.
  update tasks
  set owner_user_id = target_user_id
  where owner_user_id is null;

  -- 2. Backfill calendar event ownership.
  update calendar_events
  set user_id = target_user_id
  where user_id is null;

  -- 3. Backfill quote creator ownership.
  update quotes
  set created_by_id = target_user_id
  where created_by_id is null;

  -- 4. Backfill project ownership for consistency.
  update projects
  set owner_id = target_user_id
  where owner_id is null;
end
$$;

commit;

-- Verification queries
select count(*) as unowned_tasks from tasks where owner_user_id is null;
select count(*) as unowned_calendar_events from calendar_events where user_id is null;
select count(*) as unowned_quotes from quotes where created_by_id is null;
select count(*) as unowned_projects from projects where owner_id is null;