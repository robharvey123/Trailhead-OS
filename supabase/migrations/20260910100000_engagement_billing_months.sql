-- ============================================================================
-- Engagement billing months.
--
-- Hours were bucketed by CALENDAR month. Retainers do not always run that way:
-- QOLA-UKEU-26 runs 15th to 14th. Each engagement now carries
-- billing_month_start_day (1 to 28, default 1 = calendar month, so every other
-- engagement is unchanged), and engagement_hours_by_month buckets by that anchor.
--
-- Pre-start rule: work dated before engagements.start_date counts in the billing
-- month that contains start_date (month one), never in a month of its own.
--
-- engagement_period_start() MUST stay in step with lib/engagements/periods.ts.
-- period_month keeps its name so existing readers keep working; it now holds the
-- billing month START (e.g. 2026-08-15), and period_end is added.
-- ============================================================================

alter table engagements
  add column if not exists billing_month_start_day smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'engagements_billing_month_start_day_check'
  ) then
    alter table engagements
      add constraint engagements_billing_month_start_day_check
      check (billing_month_start_day between 1 and 28);
  end if;
end $$;

comment on column engagements.billing_month_start_day is
  'Day of the month each billing month starts (1-28). 1 = calendar month. Hours and allowances roll over on this day.';

-- Start of the billing month an entry counts in. NULL entry date stays NULL (the
-- view's left join emits one empty row per engagement with no time).
create or replace function engagement_period_start(p_entry_date date, p_start_date date, p_start_day integer)
returns date
language sql immutable parallel safe as $$
  select case
    when p_entry_date is null then null
    else (
      date_trunc(
        'month',
        (greatest(p_entry_date, coalesce(p_start_date, p_entry_date))
          - (least(greatest(coalesce(p_start_day, 1), 1), 28) - 1))::timestamp
      )::date
      + (least(greatest(coalesce(p_start_day, 1), 1), 28) - 1)
    )
  end
$$;

drop view if exists engagement_hours_by_month;
create view engagement_hours_by_month as
with bucketed as (
  select
    e.id                        as engagement_id,
    e.included_hours_monthly,
    te.duration_minutes,
    te.billable,
    engagement_period_start(te.entry_date, e.start_date, e.billing_month_start_day) as period_start
  from engagements e
  left join time_entries te
    on te.engagement_id = e.id and te.is_running = false
)
select
  engagement_id,
  period_start                                                                         as period_month,
  coalesce(sum(duration_minutes), 0) / 60.0                                             as hours_used,
  included_hours_monthly                                                               as hours_included,
  coalesce(sum(duration_minutes), 0) / 60.0 - coalesce(included_hours_monthly, 0)       as hours_over,
  coalesce(sum(case when billable then duration_minutes else 0 end), 0) / 60.0          as billable_hours,
  (period_start + interval '1 month')::date - 1                                        as period_end
from bucketed
group by engagement_id, period_start, included_hours_monthly;

-- QOLA-UKEU-26: Term 15 Aug 2026 to 15 Nov 2026 (MSA Art 4.1), billing months run
-- 15th to 14th. end_date 15 Nov puts the derived notice_date on 16 Oct, the
-- contractual deadline (was 17 Aug / 17 Nov / 18 Oct).
update engagements
   set start_date = '2026-08-15',
       end_date = '2026-11-15',
       billing_month_start_day = 15
 where code = 'QOLA-UKEU-26';
