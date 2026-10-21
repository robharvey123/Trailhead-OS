-- ============================================================================
-- One CTPS / call eligibility rule for every call queue. Idempotent.
--
-- A contact may be phoned only if ALL hold:
--   * a phone number is on file
--   * not do_not_call
--   * ctps_registered = false (null = never screened, not clear)
--   * ctps_checked_at within the last 28 days (PECR: TPS/CTPS screening must be
--     no more than 28 days old at the time of the call)
--   * not unsubscribed: contacts.do_not_email, an 'unsubscribed' or
--     'complained' email suppression, or a recipient stopped for either
--   * not bounced: a 'bounced' suppression or a recipient stopped as bounced
--
-- Everything that needs "can we call this contact?" reads the view
-- contact_call_eligibility. Nothing else should query ctps_* directly.
-- ============================================================================

-- Suppression and recipient-stop lookups are SECURITY DEFINER so the view gives
-- the same answer to a caller who cannot read email_suppressions or
-- outreach_recipients themselves (the future sales seat). They return only a
-- reason code for one contact the caller already passed in, never rows.
create or replace function public.contact_suppression_reason(p_contact_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select s.reason
  from public.contacts c
  join public.email_suppressions s on lower(s.email) = lower(c.email)
  where c.id = p_contact_id and c.email is not null
  order by case s.reason when 'complained' then 0 when 'unsubscribed' then 1 when 'bounced' then 2 else 3 end
  limit 1
$$;

create or replace function public.contact_recipient_stop_reason(p_contact_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select r.stopped_reason
  from public.outreach_recipients r
  where r.contact_id = p_contact_id
    and r.stopped_reason in ('unsubscribed', 'complained', 'bounced')
  order by case r.stopped_reason when 'complained' then 0 when 'unsubscribed' then 1 else 2 end
  limit 1
$$;

revoke all on function public.contact_suppression_reason(uuid) from public, anon;
revoke all on function public.contact_recipient_stop_reason(uuid) from public, anon;
grant execute on function public.contact_suppression_reason(uuid) to authenticated, service_role;
grant execute on function public.contact_recipient_stop_reason(uuid) to authenticated, service_role;

-- security_invoker: the caller's RLS on contacts decides which rows appear.
drop view if exists public.contact_call_eligibility;
create view public.contact_call_eligibility with (security_invoker = true) as
with base as (
  select
    c.id as contact_id,
    c.phone,
    c.do_not_call,
    c.do_not_email,
    c.ctps_registered,
    c.ctps_checked_at,
    public.contact_suppression_reason(c.id) as suppression_reason,
    public.contact_recipient_stop_reason(c.id) as stop_reason
  from public.contacts c
  where c.merged_into is null
)
select r.*, (r.reason = 'eligible') as eligible
from (
select
  b.contact_id,
  b.ctps_checked_at,
  (b.ctps_checked_at + interval '28 days') as ctps_valid_until,
  case
    when coalesce(b.do_not_call, false) then 'do_not_call'
    when coalesce(b.do_not_email, false)
      or b.suppression_reason in ('unsubscribed', 'complained')
      or b.stop_reason in ('unsubscribed', 'complained') then 'unsubscribed'
    when b.suppression_reason = 'bounced' or b.stop_reason = 'bounced' then 'bounced'
    when b.ctps_registered is true then 'ctps_registered'
    when b.ctps_checked_at is null or b.ctps_registered is null then 'unscreened'
    when b.ctps_checked_at < now() - interval '28 days' then 'ctps_stale'
    when nullif(btrim(b.phone), '') is null then 'no_phone'
    else 'eligible'
  end as reason
from base b
) r;

revoke all on public.contact_call_eligibility from anon;
grant select on public.contact_call_eligibility to authenticated, service_role;

comment on view public.contact_call_eligibility is
  'Single source of truth for whether a contact may be phoned (CTPS within 28 days, not registered, not do_not_call, not unsubscribed, not bounced, has a phone). reason = eligible when callable.';
