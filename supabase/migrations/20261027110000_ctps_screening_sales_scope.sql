-- ============================================================================
-- CTPS screening: sales-list contacts only. Idempotent.
--
-- Screening costs a Data Soap credit per number and expires after 28 days, so
-- only contacts someone will actually phone are screened: tagged onto a sales
-- list (sales_scope_tag_prefixes, e.g. "Engineer OS", "MVP Cricket"; the same
-- scope as the sales seat) and not archived. Consulting and other CRM contacts
-- carry no sales tag and are never screened. lib/ctps/screen.ts applies the
-- same rule to on-demand screening (import, create_contact, update_contact).
-- ============================================================================

drop view if exists public.contacts_needing_ctps;
create view public.contacts_needing_ctps with (security_invoker = true) as
  select id, phone, ctps_checked_at
  from public.contacts
  where phone is not null
    and btrim(phone) <> ''
    and merged_into is null
    and status <> 'archived'
    and coalesce(do_not_call, false) = false
    and public.tags_in_sales_scope(tags)
    and (ctps_checked_at is null or ctps_checked_at < now() - interval '28 days');

revoke all on public.contacts_needing_ctps from anon, authenticated;
grant select on public.contacts_needing_ctps to service_role;

comment on view public.contacts_needing_ctps is
  'Sales-list contacts (sales_scope_tag_prefixes), not archived, with a phone, not do_not_call, never CTPS-screened or screened over 28 days ago. Read by the ctps-screen cron (service role).';
