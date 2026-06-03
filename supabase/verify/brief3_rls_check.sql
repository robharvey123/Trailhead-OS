-- ============================================================================
-- Brief 3 RLS verification — run AFTER applying migrations to a database.
-- Safe to run repeatedly; read-only except for the temp role-simulation blocks
-- which run inside transactions that are rolled back.
--
-- Local apply (preferred):   supabase start && supabase db reset
-- Then:                      psql "$LOCAL_DB_URL" -f supabase/verify/brief3_rls_check.sql
-- ============================================================================

\echo '== 1. Role helpers must be SECURITY DEFINER with a pinned search_path =='
select p.proname,
       p.prosecdef            as security_definer,
       p.proconfig            as config            -- expect {search_path=...}
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin','is_employee','is_self_person','current_person_id','app_user_role')
order by p.proname;
-- PASS: security_definer = t AND config contains search_path for every row.

\echo '== 2. Expected policies exist on the re-scoped + locked-down tables =='
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('people','engagement_contributors','time_entries','profiles','invites','engagements')
order by tablename, policyname;
-- PASS: people_select/people_write_admin, ec_select/ec_write_admin,
--       te_select/te_insert/te_update/te_delete, profiles_* , invites_admin,
--       engagements_employee_rw + engagements_contributor_select.

\echo '== 3. No stale "authenticated full access" remains on locked tables =='
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and (qual ilike '%auth.role() = ''authenticated''%' or policyname ilike '%authenticated full access%')
  and tablename not in ('blog_posts','enquiries','report_tokens','workspace_members');
-- PASS: zero rows (preserved public tables are excluded above).

\echo '== 4. Owner retains full access (simulate the owner) =='
do $$
declare owner_id uuid;
begin
  select id into owner_id from profiles where role = 'owner' order by created_at limit 1;
  if owner_id is null then raise notice 'No owner profile found — backfill may not have run'; return; end if;
  raise notice 'Owner profile: %', owner_id;
end $$;

-- Template: simulate a specific user and confirm scoping. Fill in a real
-- profile id, then run inside a rolled-back transaction so nothing persists.
--
-- begin;
--   select set_config('role','authenticated', true);
--   select set_config('request.jwt.claims', json_build_object('sub','<EMPLOYEE_AUTH_UID>','role','authenticated')::text, true);
--   -- employee should see only their own time entries:
--   select count(*) as visible_time_entries from time_entries;
--   -- employee should NOT see engagements they're not a contributor on:
--   select count(*) as visible_engagements from engagements;
-- rollback;
