-- Invoice currency + FX snapshot. Additive, idempotent, nullable-safe: every
-- existing invoice is GBP at rate 1.0 and keeps working untouched.

alter table invoices
  add column if not exists currency text not null default 'GBP',
  add column if not exists fx_rate_to_gbp numeric(18,8) not null default 1.0,
  add column if not exists fx_rate_date date,
  add column if not exists fx_rate_source text;

do $$ begin
  alter table invoices add constraint invoices_currency_iso check (currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table invoices add constraint invoices_fx_rate_positive check (fx_rate_to_gbp > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table invoices add constraint invoices_gbp_rate_is_one
    check (currency <> 'GBP' or fx_rate_to_gbp = 1.0);
exception when duplicate_object then null; end $$;

comment on column invoices.fx_rate_to_gbp is
  'Multiply an amount in invoices.currency by this to get GBP. Snapshotted at issue and never recalculated, so historic invoices do not move when rates do.';

-- Rebuild the engagement billing summary so every money figure is GBP-normalised
-- (mixed-currency engagements sum correctly), and the number of distinct
-- currencies is surfaced so a mixed-currency engagement can never look
-- single-currency. The old column names are KEPT but now carry GBP totals — there
-- is deliberately no native-summed column with a similar name. security_invoker
-- MUST stay true or the view runs as owner and bypasses invoice RLS.
drop view if exists engagement_billing_summary;
create view engagement_billing_summary
  with (security_invoker = true) as
with lines as (
  select
    i.id, i.engagement_id, i.status, i.due_date, i.paid_at,
    i.currency,
    i.fx_rate_to_gbp,
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
    id, engagement_id, status, due_date, paid_at, currency,
    -- GBP conversion rounds per invoice, not per line; the sum of GBP equivalents
    -- may differ by a penny from converting a summed total. Fine for reporting;
    -- do not use for anything that must tie to the bank.
    round(subtotal * (1 + vat_rate / 100.0) * fx_rate_to_gbp, 2) as total_gbp
  from lines
)
select
  engagement_id,
  count(*)                                                                as invoice_count,
  count(distinct currency)                                                as currency_count,
  array_agg(distinct currency order by currency)                          as currencies,
  coalesce(sum(total_gbp) filter (where status <> 'cancelled'), 0)        as total_invoiced,
  coalesce(sum(total_gbp) filter (where status = 'paid'), 0)              as total_paid,
  coalesce(sum(total_gbp) filter (where status in ('sent','overdue')), 0) as total_outstanding,
  coalesce(sum(total_gbp) filter (where status = 'draft'), 0)             as total_draft,
  count(*) filter (where status = 'draft')                                as draft_count,
  count(*) filter (where status = 'sent')                                 as sent_count,
  count(*) filter (where status = 'paid')                                 as paid_count,
  count(*) filter (where status = 'overdue')                              as overdue_count,
  min(due_date) filter (where status in ('sent','overdue'))               as next_due_date,
  max(paid_at)                                                            as last_payment_at
from totals
group by engagement_id;
