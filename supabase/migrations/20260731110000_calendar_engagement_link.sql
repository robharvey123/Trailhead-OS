-- Stage B (engagement reporting) — let a calendar event belong to an engagement.
--
-- calendar_events had no engagement link, so "meetings held this period" could
-- not be sourced factually. Add a nullable FK — no backfill, no default, per the
-- standing column rule. The period spine reads events on this FK, unioned with
-- Granola meetings matched on the engagement's client accounts.

alter table calendar_events
  add column if not exists engagement_id uuid references engagements(id) on delete set null;

create index if not exists idx_calendar_events_engagement on calendar_events (engagement_id);
