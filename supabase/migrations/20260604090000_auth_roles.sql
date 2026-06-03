-- ============================================================================
-- Brief 3 — Auth, roles, invite flow (core).
--
-- DEVIATIONS FROM BRIEF (reconciled against the real schema):
--   • Brief 2 never created is_owner()/is_self() or policies like
--     people_write_owner / te_insert_self_or_owner. The REAL policies are
--     people_authenticated_full_access, engagement_contributors_authenticated_full_access,
--     and on time_entries a stale "authenticated full access" (all rows) PLUS four
--     per-user policies. We drop the actual policies here so the new role RLS is
--     not silently OR'd-away by a surviving full-access policy.
--   • Token default uses gen_random_uuid() hex (×2), not encode(...,'base64url')
--     which is NOT a valid Postgres encode format.
--   • Reuses update_workspace_updated_at(); the brief's set_updated_at() does not exist.
--   • Self-role-elevation is blocked by a trigger (robust) rather than a fragile
--     WITH CHECK that re-queries the row mid-update.
-- The broad lockdown of all other OS tables is in the companion migration
-- 20260604090100_rls_lockdown.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ROLE ENUM
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('owner', 'admin', 'employee', 'contractor');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES (one per auth user)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid unique references people(id) on delete set null,
  role user_role not null default 'employee',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_workspace_updated_at();

-- ---------------------------------------------------------------------------
-- INVITES
-- ---------------------------------------------------------------------------
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role user_role not null default 'employee',
  person_id uuid references people(id) on delete set null,
  token text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invites_pending_email on invites (email) where claimed_at is null;

-- ---------------------------------------------------------------------------
-- AUTO-CREATE PROFILE ON NEW AUTH USER
-- security definer + explicit search_path (avoids Supabase linter warning).
-- ---------------------------------------------------------------------------
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Backfill: every existing auth user becomes an owner (single-tenant origin).
-- Rob should downgrade any extras manually after running.
insert into profiles (id, role, display_name)
select u.id, 'owner'::user_role, coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- Link the owner's profile to the people row the v2 backfill created for them.
update profiles p
set person_id = pe.id
from people pe
where pe.auth_user_id = p.id and p.person_id is null;

-- ---------------------------------------------------------------------------
-- ROLE HELPERS
-- ---------------------------------------------------------------------------
-- Note: current_role is a reserved Postgres function, hence app_user_role().
create or replace function app_user_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(app_user_role() in ('owner', 'admin'), false);
$$;

create or replace function is_employee()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(app_user_role() in ('owner', 'admin', 'employee'), false);
$$;

create or replace function current_person_id()
returns uuid language sql stable security definer set search_path = public as $$
  select person_id from profiles where id = auth.uid();
$$;

create or replace function is_self_person(p_person_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_person_id is not null and p_person_id = current_person_id();
$$;

-- ---------------------------------------------------------------------------
-- RE-SCOPE THE 5 BRIEF-2 TABLES — drop the REAL policies, recreate by role
-- ---------------------------------------------------------------------------
-- people
drop policy if exists people_authenticated_full_access on people;
create policy people_select on people for select
  using (is_admin() or auth_user_id = auth.uid());
create policy people_write_admin on people for all
  using (is_admin()) with check (is_admin());

-- engagement_contributors
drop policy if exists engagement_contributors_authenticated_full_access on engagement_contributors;
create policy ec_select on engagement_contributors for select
  using (is_admin() or is_self_person(person_id));
create policy ec_write_admin on engagement_contributors for all
  using (is_admin()) with check (is_admin());

-- time_entries — drop the stale full-access policy AND the per-user ones.
drop policy if exists "authenticated full access" on time_entries;
drop policy if exists "authenticated can view own time entries" on time_entries;
drop policy if exists "authenticated can insert own time entries" on time_entries;
drop policy if exists "authenticated can update own time entries" on time_entries;
drop policy if exists "authenticated can delete own time entries" on time_entries;
create policy te_select on time_entries for select
  using (is_admin() or is_self_person(person_id));
create policy te_insert on time_entries for insert
  with check (is_admin() or is_self_person(person_id));
create policy te_update on time_entries for update
  using (is_admin() or is_self_person(person_id))
  with check (is_admin() or is_self_person(person_id));
create policy te_delete on time_entries for delete
  using (is_admin());

-- ---------------------------------------------------------------------------
-- PROFILES RLS — self can read/update own; admins manage all. Role changes by
-- non-admins are blocked by trigger (see below), so the update policy is simple.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (is_admin() or id = auth.uid());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_all on profiles;
create policy profiles_admin_all on profiles for all
  using (is_admin()) with check (is_admin());

-- Block self-elevation: only admins may change a profile's role.
create or replace function enforce_profile_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;
  return new;
end $$;
drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function enforce_profile_role_change();

-- ---------------------------------------------------------------------------
-- INVITES RLS — admins only. Public claim goes through a service-role server
-- action, so no public policy is needed.
-- ---------------------------------------------------------------------------
alter table invites enable row level security;
drop policy if exists invites_admin on invites;
create policy invites_admin on invites for all
  using (is_admin()) with check (is_admin());
