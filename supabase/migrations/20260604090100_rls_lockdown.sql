-- ============================================================================
-- Brief 3 — Lock down all remaining OS tables by role (companion to auth_roles).
--
-- Model (coarse; granular per-engagement perms are an explicit follow-up):
--   • EMPLOYEE_RW  → owner/admin/employee full access; contractors excluded
--                    (fail-closed: contractors get nothing here until granular
--                    per-engagement permissions land).
--   • ADMIN_ONLY   → integration secrets / settings: owner/admin only.
--   • The 5 self-scoped tables (people, engagement_contributors, time_entries,
--     profiles, invites) are handled in 20260604090000_auth_roles.sql and are
--     deliberately NOT touched here.
--   • Public-facing policies are preserved (KEEP_POLICIES) so client report,
--     discovery-form and marketing-blog access keep working.
--   • Legacy workspace/analytics tables (workspace_*, sell_in, sell_out,
--     customer_mappings, staff_*, crm_*) are already member-scoped and are left
--     alone on purpose.
--
-- Each table is guarded by to_regclass so a missing table is skipped, not fatal.
-- owner ∈ both helpers, so the existing single user keeps full access — the
-- failure direction here is "still open", never "owner locked out".
-- ============================================================================

do $$
declare
  t text;
  pol record;
  employee_tables text[] := array[
    'accounts','contacts','projects','project_phases','project_milestones','project_contacts',
    'workstreams','board_columns','tasks','notes','task_checklists','task_attachments',
    'task_time_logs','task_activity','task_dependencies','calendar_events','activities',
    'quotes','quote_versions','pricing_tiers','engagements','engagement_tier1_accounts',
    'tier1_milestones','engagement_documents','approval_requests','deals','tags','account_tags',
    'deal_tags','attachments','saved_views','invoices','touchpoints','expenses','enquiries','blog_posts'
  ];
  admin_tables text[] := array[
    'google_tokens','microsoft_tokens','ms_cal_sync','gcal_sync','google_calendar_selections',
    'microsoft_calendar_selections','calendar_feeds','stripe_customers','email_logs','os_company_settings'
  ];
  -- Public policies that must survive (client reports / discovery / marketing).
  keep_policies text[] := array['public can read published posts','public can insert enquiries'];
begin
  -- EMPLOYEE_RW
  foreach t in array employee_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      if not (pol.policyname = any(keep_policies)) then
        execute format('drop policy %I on %I', pol.policyname, t);
      end if;
    end loop;
    execute format(
      'create policy %I on %I for all to authenticated using (is_employee()) with check (is_employee())',
      t || '_employee_rw', t
    );
  end loop;

  -- ADMIN_ONLY
  foreach t in array admin_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table %I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', pol.policyname, t);
    end loop;
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_admin_rw', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- CONTRACTORS: read-only access to engagements they actively contribute to.
-- Added alongside engagements_employee_rw (permissive policies are OR'd), so
-- owner/admin/employee keep full access via that policy and contractors gain
-- SELECT on just their engagements — without widening is_employee(). This is
-- also what makes the timesheet engagement picker work for a contractor.
-- (Defined after the DO block so the loop's blanket drop doesn't remove it;
--  drop-if-exists keeps the migration rerunnable.)
-- ---------------------------------------------------------------------------
drop policy if exists engagements_contributor_select on engagements;
create policy engagements_contributor_select on engagements for select to authenticated
  using (
    is_admin() or exists (
      select 1 from engagement_contributors ec
      where ec.engagement_id = engagements.id
        and ec.person_id = current_person_id()
        and ec.is_active
    )
  );
