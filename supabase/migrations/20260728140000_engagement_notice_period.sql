-- ============================================================================
-- Engagement notice periods. Renewal flagging must fire on the NOTICE deadline
-- (N days before term end), not on end_date itself. notice_date is DERIVED in the
-- database and never stored, so it always follows end_date if the term is extended.
-- ============================================================================

alter table engagements
  add column if not exists notice_period_days integer,
  add column if not exists auto_renews boolean not null default false,
  add column if not exists renewal_term_months integer;

-- Live Qola engagement: MSA Art 4.1, 30 days' written notice before 15 Nov 2026,
-- auto-renews for successive 1-year periods.
update engagements
   set notice_period_days = 30, auto_renews = true, renewal_term_months = 12
 where code = 'QOLA-UKEU-26';

-- Derived notice date, computed in Postgres (date - integer = date, no timezone
-- drift) and NEVER stored. Exposed as a PostgREST computed column, so it can be
-- read with select('notice_date') and always tracks the current end_date.
create or replace function notice_date(engagements) returns date
language sql stable as $$
  select case
    when $1.notice_period_days is not null and $1.end_date is not null
      then $1.end_date - $1.notice_period_days
  end
$$;
