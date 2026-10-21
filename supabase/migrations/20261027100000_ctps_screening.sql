-- ============================================================================
-- Automatic CTPS/TPS screening (Data Soap). Idempotent.
--
--   * ctps_checks: one row per lookup we paid for (PECR evidence).
--   * A changed phone number is an unscreened number: the trigger nulls
--     ctps_registered / ctps_checked_at so contact_call_eligibility reports
--     'unscreened' until the nightly screen (or create_contact) re-checks it.
--   * contacts_needing_ctps: who the cron screens next.
--
-- Trigger order: BEFORE UPDATE triggers fire alphabetically, so
-- contacts_sales_guard runs before trg_contacts_phone_change_resets_ctps. The
-- guard already refuses a phone change from the sales seat, so the reset only
-- ever runs for owner/admin/service-role writes, and the guard never sees the
-- ctps_* columns the reset clears.
-- ============================================================================

-- CTPS/TPS screening audit. One row per lookup we paid for. PECR evidence.
create table if not exists public.ctps_checks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  phone_raw text not null,
  phone_normalised text not null,
  tps boolean,
  ctps boolean,
  registered boolean generated always as (coalesce(tps, false) or coalesce(ctps, false)) stored,
  provider text not null default 'datasoap',
  credits_used int,
  error_code int,
  error_message text,
  source text not null check (source in ('cron', 'create', 'import', 'manual', 'mcp')),
  checked_at timestamptz not null default now()
);
create index if not exists idx_ctps_checks_contact on public.ctps_checks (contact_id, checked_at desc);
create index if not exists idx_ctps_checks_phone on public.ctps_checks (phone_normalised, checked_at desc);
create index if not exists idx_ctps_checks_source on public.ctps_checks (source, checked_at desc);
alter table public.ctps_checks enable row level security;
-- Service role only (no policies). Admin UI reads go through server code with
-- the service client.
revoke all on public.ctps_checks from anon, authenticated;
grant all on public.ctps_checks to service_role;

comment on table public.ctps_checks is
  'One row per paid CTPS/TPS lookup (Data Soap), including failed ones. PECR screening evidence. Service role only.';

-- A changed phone number is an unscreened number.
create or replace function public.contacts_phone_change_resets_ctps() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is distinct from old.phone then
    new.ctps_registered := null;
    new.ctps_checked_at := null;
  end if;
  return new;
end $$;
revoke all on function public.contacts_phone_change_resets_ctps() from public, anon, authenticated;

drop trigger if exists trg_contacts_phone_change_resets_ctps on public.contacts;
create trigger trg_contacts_phone_change_resets_ctps
  before update of phone on public.contacts
  for each row execute function public.contacts_phone_change_resets_ctps();

-- Who needs screening. Used by the cron and the dashboard. security_invoker so
-- the caller's RLS on contacts applies; exposed to the service role only, so it
-- can never become a phone-number list over PostgREST.
drop view if exists public.contacts_needing_ctps;
create view public.contacts_needing_ctps with (security_invoker = true) as
  select id, phone, ctps_checked_at
  from public.contacts
  where phone is not null
    and btrim(phone) <> ''
    and merged_into is null
    and coalesce(do_not_call, false) = false
    and (ctps_checked_at is null or ctps_checked_at < now() - interval '28 days');

revoke all on public.contacts_needing_ctps from anon, authenticated;
grant select on public.contacts_needing_ctps to service_role;

comment on view public.contacts_needing_ctps is
  'Contacts with a phone, not do_not_call, never CTPS-screened or screened over 28 days ago. Read by the ctps-screen cron (service role).';
