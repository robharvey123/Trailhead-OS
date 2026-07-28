-- ============================================================================
-- Link invoices to engagements.
--
-- Before this, the only invoice-to-engagement relationship in the schema was
-- tier1_milestones.fee_invoice_id, which covers performance fees on Tier 1
-- listings and nothing else. Retainer, overage and expense invoices had no way
-- to attach to the engagement they belong to, so an engagement could not report
-- what it had billed or what was outstanding.
--
-- Additive and idempotent. engagement_id is nullable throughout: every existing
-- invoice keeps working untouched.
-- ============================================================================

alter table invoices
  add column if not exists engagement_id uuid references engagements(id) on delete set null;

create index if not exists idx_invoices_engagement on invoices (engagement_id);

-- Backfill from the one link that already existed: any invoice raised against a
-- Tier 1 milestone belongs to that milestone's engagement.
update invoices i
   set engagement_id = m.engagement_id
  from tier1_milestones m
 where m.fee_invoice_id = i.id
   and i.engagement_id is null;

-- ---------------------------------------------------------------------------
-- Billing summary per engagement. Mirrors the shape of tier1_milestone_summary
-- so the engagement detail page can consume both the same way.
-- security_invoker so the querying user's RLS on invoices applies.
-- ---------------------------------------------------------------------------
drop view if exists engagement_billing_summary;
create view engagement_billing_summary
  with (security_invoker = true) as
with lines as (
  select
    i.id,
    i.engagement_id,
    i.status,
    i.due_date,
    i.paid_at,
    coalesce(i.vat_rate, 0) as vat_rate,
    coalesce((
      select sum(coalesce((li ->> 'qty')::numeric, 0) * coalesce((li ->> 'unit_price')::numeric, 0))
        from jsonb_array_elements(coalesce(i.line_items, '[]'::jsonb)) as li
    ), 0) as subtotal
  from invoices i
  where i.engagement_id is not null
    and i.deleted_at is null
),
totals as (
  select
    id, engagement_id, status, due_date, paid_at,
    round(subtotal * (1 + vat_rate / 100.0), 2) as total
  from lines
)
select
  engagement_id,
  count(*)                                                              as invoice_count,
  coalesce(sum(total) filter (where status <> 'cancelled'), 0)          as total_invoiced,
  coalesce(sum(total) filter (where status = 'paid'), 0)                as total_paid,
  coalesce(sum(total) filter (where status in ('sent','overdue')), 0)   as total_outstanding,
  coalesce(sum(total) filter (where status = 'draft'), 0)               as total_draft,
  count(*) filter (where status = 'draft')                              as draft_count,
  count(*) filter (where status = 'sent')                               as sent_count,
  count(*) filter (where status = 'paid')                               as paid_count,
  count(*) filter (where status = 'overdue')                            as overdue_count,
  min(due_date) filter (where status in ('sent','overdue'))             as next_due_date,
  max(paid_at)                                                          as last_payment_at
from totals
group by engagement_id;
