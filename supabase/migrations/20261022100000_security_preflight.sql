-- ============================================================================
-- Security preflight (Phase B0 of the sales seat work). Must land before any
-- second login exists. Idempotent. Runs after 20261005160000.
--
-- S1  New sign-ups no longer default to 'employee' (full core-table access).
-- S4  Four tables that drifted back to "any authenticated user" are locked to
--     is_employee(), matching the 20260604090100 lockdown. (engagement_document_files,
--     flagged in discovery, is already locked down on production; left alone.)
-- S5  Definer views (they run with the owner's rights and so ignore RLS) were
--     selectable by anon and by every authenticated role. Each is gated.
-- S6  tasks_backlog_archive_20261013 had RLS off and anon SELECT.
--     report_tokens let anon list every token.
-- D10 The dormant robharvey123@gmail.com login is downgraded from admin, and
--     the Google events the calendar cron filed under it move to the owner.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- S1: least-privileged default role for any profile created by sign-up.
-- Invites set the real role explicitly on claim, so they are unaffected.
-- ---------------------------------------------------------------------------
alter table public.profiles alter column role set default 'contractor';

-- ---------------------------------------------------------------------------
-- S4: replace the open policies with the standard employee policy.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['deal_projects', 'meeting_accounts', 'invoice_payments', 'remittance_accounts']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format('drop policy if exists "authenticated full access %s" on public.%I', t, t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_full_access', t);
    execute format('drop policy if exists %I on public.%I', t || '_employee_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_employee()) with check (public.is_employee())',
      t || '_employee_rw', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- S6a: report_tokens. The public report page now looks tokens up with the
-- service role, so anon needs no access at all; managing tokens is admin-only.
-- ---------------------------------------------------------------------------
drop policy if exists "public can read token by value" on public.report_tokens;
drop policy if exists "authenticated can manage tokens" on public.report_tokens;
drop policy if exists report_tokens_admin_rw on public.report_tokens;
create policy report_tokens_admin_rw on public.report_tokens for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.report_tokens from anon;

-- ---------------------------------------------------------------------------
-- S6b: the backlog archive snapshot. RLS on with no policies = deny for anon
-- and authenticated; service role and SQL editor still read it.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tasks_backlog_archive_20261013') is not null then
    execute 'alter table public.tasks_backlog_archive_20261013 enable row level security';
    execute 'revoke all on public.tasks_backlog_archive_20261013 from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- S5: definer views. Postgres runs a view with its owner's privileges, so RLS
-- on the underlying tables does not apply. current_user inside the view body
-- is still the caller, so a gate on it restricts the view to service role,
-- postgres and staff (is_employee). This deliberately keeps definer semantics:
-- switching the analytics views to security_invoker would hide every workspace
-- from Rob, because his owner login is not a workspace_members row.
--
-- NOTE for future migrations: a plain `create or replace view` of one of these
-- views drops the gate. Re-run the DO block below (or add the gate by hand).
-- ---------------------------------------------------------------------------
create or replace function public.view_gate_allows() returns boolean
language sql stable set search_path = '' as $$
  select current_user::text not in ('anon', 'authenticated') or public.is_employee()
$$;
comment on function public.view_gate_allows() is
  'Row gate for definer views: service role, postgres and is_employee() callers only. Deliberately SECURITY INVOKER so current_user is the caller.';

do $$
declare
  r record;
  def text;
begin
  for r in
    select c.oid, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)
      and not coalesce('security_invoker=on' = any (c.reloptions), false)
  loop
    def := pg_get_viewdef(r.oid, true);
    if position('view_gate_allows' in def) > 0 then
      continue; -- already gated
    end if;
    def := regexp_replace(def, ';\s*$', '');
    execute format('create or replace view public.%I as select s.* from (%s) s where public.view_gate_allows()', r.relname, def);
  end loop;
end $$;

-- No view in public is meant for anon (the public report reads with the service role).
do $$
declare
  r record;
begin
  for r in select viewname from pg_views where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', r.viewname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- D10: retire the dormant admin login and re-home its synced events.
-- The repo's enforce_profile_role_change() requires is_admin(), which a
-- migration (no JWT) never satisfies. Production's copy has since gained an
-- auth.uid() is null bypass that is not in any migration; toggling the trigger
-- makes this work against either version.
-- ---------------------------------------------------------------------------
do $$
declare
  dormant uuid;
  owner_id uuid := public.owner_user_id();
begin
  select u.id into dormant from auth.users u where lower(u.email) = 'robharvey123@gmail.com';
  if dormant is null or owner_id is null or dormant = owner_id then
    return;
  end if;

  update public.calendar_events set user_id = owner_id where user_id = dormant;

  if exists (select 1 from public.profiles where id = dormant and role in ('owner', 'admin')) then
    alter table public.profiles disable trigger profiles_role_guard;
    update public.profiles set role = 'contractor' where id = dormant;
    alter table public.profiles enable trigger profiles_role_guard;
  end if;
end $$;
