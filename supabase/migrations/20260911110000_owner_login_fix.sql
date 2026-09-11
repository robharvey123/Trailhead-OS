-- ============================================================================
-- Owner login fix.
--
-- Two auth users exist for Rob: robharvey123@gmail.com (562e543d…, created
-- first, last signed in March 2026) and rob@trailheadholdings.uk (23aa84e2…,
-- role owner, the login actually in use). people.auth_user_id pointed at the
-- gmail user, and owner_user_id() picked "earliest auth user", so Cowork/MCP
-- time entries and person resolution were keyed to the dormant login.
--
-- Source of truth from here on: the profile with role = 'owner'. Everything
-- else (people.auth_user_id, owner_user_id(), owner_person_id(), the
-- profiles.person_id link, historic time_entries.user_id) follows it.
-- Idempotent. Runs after 20260911100000_time_entry_links.sql.
-- ============================================================================

-- owner_user_id(): the owner-role profile's auth user; fall back to the
-- earliest auth user only if no owner profile exists.
create or replace function public.owner_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.id from public.profiles p where p.role = 'owner' order by p.id limit 1),
    (select u.id from auth.users u order by u.created_at asc limit 1)
  )
$$;

-- owner_person_id() is unchanged in body (people.auth_user_id = owner_user_id())
-- but re-created so it binds to the new owner_user_id() definition explicitly.
create or replace function public.owner_person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.people p where p.auth_user_id = public.owner_user_id() limit 1
$$;

-- Repoint Rob's person row at the owner login. Deliberately explicit: this is a
-- one-row data fix, and future contributors will have their own logins.
update people
set auth_user_id = public.owner_user_id()
where id = '150cc90e-5979-42c4-8be8-0e1531e305c3'
  and auth_user_id is distinct from public.owner_user_id();

-- Re-link profiles.person_id from people.auth_user_id (unique: release first).
update profiles p
set person_id = null
from people pe
where p.person_id = pe.id
  and pe.auth_user_id is not null
  and pe.auth_user_id <> p.id;

update profiles p
set person_id = pe.id
from people pe
where pe.auth_user_id = p.id
  and p.person_id is distinct from pe.id;

-- Historic time entries written under the dormant login move to the owner login
-- (person_id is already correct on every row; user_id drives the running-timer
-- lookup and the one-timer-per-user index).
update time_entries te
set user_id = public.owner_user_id()
where te.user_id <> public.owner_user_id()
  and te.person_id = public.owner_person_id();

-- Checks
-- select public.owner_user_id(), public.owner_person_id();
-- select p.id, p.role, p.person_id, u.email from profiles p join auth.users u on u.id = p.id;
-- select user_id, count(*) from time_entries group by 1;
