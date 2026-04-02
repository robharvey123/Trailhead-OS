alter table tasks
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

alter table calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_tasks_owner_user_id on tasks(owner_user_id);
create index if not exists idx_calendar_events_user_id on calendar_events(user_id);

do $$
declare
  single_user_id uuid;
  user_count integer;
begin
  select count(*)::integer into user_count from auth.users;

  if user_count = 1 then
    select id into single_user_id from auth.users limit 1;

    update tasks
    set owner_user_id = single_user_id
    where owner_user_id is null;

    update calendar_events
    set user_id = single_user_id
    where user_id is null;

    update quotes
    set created_by_id = single_user_id
    where created_by_id is null;

    update projects
    set owner_id = single_user_id
    where owner_id is null;
  end if;
end
$$;