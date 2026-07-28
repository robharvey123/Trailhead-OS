-- ============================================================================
-- Cowork API v2 — support for accounts, engagements, tier-1, milestones, time.
--
-- Two things the REST/MCP layer needs from the database:
--   1. A 'cowork' source value on time_entries, so entries written by the API are
--      distinguishable from manual UI entries and timer entries.
--   2. A single, authoritative resolution of "the owner" — this is a single-tenant
--      OS with one human. Cowork runs with the service role (no auth session), so
--      it cannot read auth.uid(); these functions let server code resolve the owner
--      user and person once, in the database, instead of guessing.
-- Additive and idempotent.
-- ============================================================================

-- Cowork-written time entries need a source value of their own.
alter table time_entries drop constraint if exists time_entries_source_check;
alter table time_entries add constraint time_entries_source_check
  check (source in ('manual', 'timer', 'cowork'));

-- Resolve the single owner once, in the database, so server code never guesses.
create or replace function owner_user_id() returns uuid
language sql stable as $$
  select id from auth.users order by created_at asc limit 1
$$;

create or replace function owner_person_id() returns uuid
language sql stable as $$
  select p.id from people p where p.auth_user_id = owner_user_id() limit 1
$$;
