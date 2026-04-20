-- Complete RLS fix for quotes and calendar_events
-- Also ensures tasks policy is correct and backfills owner_user_id

-- Tasks (idempotent - may already be fixed by previous migration)
drop policy if exists tasks_owner_access on tasks;
drop policy if exists tasks_authenticated_full_access on tasks;
create policy tasks_authenticated_full_access
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Quotes
drop policy if exists quotes_owner_access on quotes;
drop policy if exists quotes_authenticated_full_access on quotes;
create policy quotes_authenticated_full_access
  on quotes for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Calendar events
drop policy if exists calendar_events_owner_access on calendar_events;
drop policy if exists calendar_events_authenticated_full_access on calendar_events;
create policy calendar_events_authenticated_full_access
  on calendar_events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Backfill owner_user_id on orphan tasks
update tasks
set owner_user_id = '562e543d-6bc8-4211-bca9-cc7ab238d8b5'
where owner_user_id is null;
