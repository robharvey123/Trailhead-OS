-- ============================================================================
-- v2 — Engagement types, contributors (people) and per-contributor time.
--
-- SCOPE NOTES (deviations from the original brief, agreed with Rob):
--   • Single-tenant, attribution-only. `people` are labels Rob manages — they
--     do NOT log in. RLS stays `auth.role() = 'authenticated'` full access to
--     match every other OS table. No is_owner()/is_self() model.
--   • time_entries already exists (20260601093000). We extend it additively:
--     add person_id and REUSE the existing rate_snapshot column for cost
--     (GBP is the global currency) rather than add a near-duplicate
--     rate_snapshot_gbp. Hours are derived from duration_minutes / 60.
--   • end_client_account_id becomes nullable so internal engagements (no client)
--     are representable.
-- Additive only. Reuses update_workspace_updated_at() for updated_at triggers.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENGAGEMENT TYPE + BILLABLE FLAG
-- ---------------------------------------------------------------------------
do $$ begin
  create type engagement_type as enum (
    'client_consulting',
    'client_app_build',
    'internal_app_build',
    'internal_ops'
  );
exception when duplicate_object then null;
end $$;

alter table engagements
  add column if not exists engagement_type engagement_type not null default 'client_consulting';

alter table engagements
  add column if not exists is_billable boolean generated always as (
    engagement_type in ('client_consulting', 'client_app_build')
  ) stored;

-- Internal engagements have no end client. Existing rows already have one, so
-- dropping NOT NULL is safe and lets internal_* engagements omit it.
alter table engagements alter column end_client_account_id drop not null;

-- ---------------------------------------------------------------------------
-- PEOPLE (contributors) — attribution labels, separate from auth.users
-- ---------------------------------------------------------------------------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  default_hourly_rate_gbp numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_people_active on people (is_active);

-- ---------------------------------------------------------------------------
-- ENGAGEMENT CONTRIBUTORS — who works on what, with a rate snapshot
-- ---------------------------------------------------------------------------
create table if not exists engagement_contributors (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  person_id uuid not null references people(id) on delete restrict,
  role text,
  hourly_rate_gbp numeric(10,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (engagement_id, person_id)
);
create index if not exists idx_engagement_contributors_engagement on engagement_contributors (engagement_id);
create index if not exists idx_engagement_contributors_person on engagement_contributors (person_id);

-- ---------------------------------------------------------------------------
-- TIME ENTRIES — add contributor attribution (additive)
-- ---------------------------------------------------------------------------
-- person_id = who did the work (attribution). user_id stays = who is logged in
-- (entry author / RLS owner). rate_snapshot (existing column) holds the GBP
-- cost rate, snapshotted from engagement_contributors at entry time.
alter table time_entries
  add column if not exists person_id uuid references people(id) on delete restrict;
create index if not exists idx_time_entries_person_date on time_entries (person_id, entry_date);

-- ---------------------------------------------------------------------------
-- BACKFILL — give the owner a people row and attribute existing entries to it
-- ---------------------------------------------------------------------------
-- Earliest auth user is the owner (Rob) in this single-tenant app.
insert into people (full_name, email, auth_user_id)
select
  coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''), split_part(u.email, '@', 1)),
  u.email,
  u.id
from auth.users u
order by u.created_at asc
limit 1
on conflict (auth_user_id) do nothing;

update time_entries te
set person_id = p.id
from people p
where te.person_id is null and te.user_id = p.auth_user_id;

-- ---------------------------------------------------------------------------
-- RLS — authenticated full access (OS pattern). time_entries keeps its own
-- user-scoped policies from 20260601093000.
-- ---------------------------------------------------------------------------
alter table people enable row level security;
alter table engagement_contributors enable row level security;

drop policy if exists people_authenticated_full_access on people;
create policy people_authenticated_full_access on people for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists engagement_contributors_authenticated_full_access on engagement_contributors;
create policy engagement_contributors_authenticated_full_access on engagement_contributors for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
