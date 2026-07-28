-- ============================================================================
-- Harden the owner-resolution functions from 20260728110000.
--
-- owner_user_id() reads auth.users, but the service role (which the Cowork API
-- uses) has no SELECT on auth.users, so the plain SQL functions failed at call
-- time with "permission denied for table users". SECURITY DEFINER runs them as
-- the function owner (which can read auth.users); an empty search_path with fully
-- qualified names keeps a definer function safe from search_path injection.
-- ============================================================================

create or replace function public.owner_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users order by created_at asc limit 1
$$;

create or replace function public.owner_person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.people p where p.auth_user_id = public.owner_user_id() limit 1
$$;
