drop policy if exists tasks_authenticated_full_access on tasks;
drop policy if exists "authenticated full access" on quotes;
drop policy if exists "authenticated full access" on calendar_events;

drop policy if exists tasks_owner_access on tasks;
create policy tasks_owner_access
  on tasks for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists quotes_owner_access on quotes;
create policy quotes_owner_access
  on quotes for all
  using (created_by_id = auth.uid())
  with check (created_by_id = auth.uid());

drop policy if exists calendar_events_owner_access on calendar_events;
create policy calendar_events_owner_access
  on calendar_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());