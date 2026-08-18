-- Growth Phase 5 (outreach through the CRM).
--
-- accounts.record_type splits link-building prospects from the sales pipeline
-- WITHOUT a parallel outreach table: prospects are real CRM accounts (so email
-- history, notes and contacts live where they belong) but every sales-facing
-- list, picker, search and domain-matcher filters to record_type = 'sales'
-- (application-side sweep in the same commit). The not-null default backfills
-- every existing row as sales, so behaviour is unchanged until the first
-- link_prospect row is inserted.

alter table accounts add column if not exists record_type text not null default 'sales';
create index if not exists idx_accounts_record_type on accounts (record_type);

-- The one account-rooted aggregate view: keep it sales-only.
drop view if exists account_overview;
create view account_overview as
  select
    a.id,
    a.name,
    a.channel,
    a.status,
    coalesce(d.open_deal_count, 0)    as open_deal_count,
    coalesce(d.open_deal_value, 0)    as open_deal_value,
    coalesce(t.open_task_count, 0)    as open_task_count,
    coalesce(p.open_project_count, 0) as open_project_count
  from accounts a
  left join (
    select account_id,
           count(*)                       as open_deal_count,
           coalesce(sum(value_amount), 0) as open_deal_value
    from deals
    where stage not in ('Won', 'Lost', 'On Hold')
    group by account_id
  ) d on d.account_id = a.id
  left join (
    select account_id, count(*) as open_task_count
    from tasks
    where status in ('todo', 'in_progress', 'blocked')
    group by account_id
  ) t on t.account_id = a.id
  left join (
    select account_id, count(*) as open_project_count
    from projects
    where status not in ('completed', 'archived', 'cancelled')
    group by account_id
  ) p on p.account_id = a.id
  where a.record_type = 'sales';

-- Outreach follow-up state on link targets: outreach_at stamps when outreach
-- started; followup_created guarantees the 7-day follow-up task fires once
-- only, never twice.
alter table seo_link_targets add column if not exists outreach_at timestamptz;
alter table seo_link_targets add column if not exists followup_created boolean not null default false;
