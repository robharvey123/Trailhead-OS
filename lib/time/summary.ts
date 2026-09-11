// The one set of hours/amount maths. Every reader — engagement Time tab,
// project Time panel, timesheet totals, /reports/hours-by-*, engagement report
// data, Cowork summaries — aggregates through summariseTime so they agree to
// the penny. Hours = duration_minutes / 60; amount counts only billable rows;
// rounding happens ONCE at the end, never per row.

import {
  billingPeriodFromStart,
  billingPeriodStartFor,
  type BillingPeriod,
  type BillingPeriodBasis,
} from '@/lib/engagements/periods'
import type { TimeEntryLedgerRow } from '@/lib/types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface TimeGroupSummary {
  id: string | null
  name: string
  hours: number
  billable_hours: number
  amount: number
}

export interface TimeSummary {
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  amount: number
  unbilled_amount: number
  entry_count: number
  by_project: TimeGroupSummary[]
  by_person: TimeGroupSummary[]
  by_task: TimeGroupSummary[]
  by_engagement: TimeGroupSummary[]
  by_day: Array<{ date: string; hours: number; amount: number }>
}

type Keyed = { id: string | null; name: string }

function groupBy(rows: TimeEntryLedgerRow[], keyOf: (r: TimeEntryLedgerRow) => Keyed): TimeGroupSummary[] {
  const map = new Map<string, { id: string | null; name: string; minutes: number; billableMinutes: number; amount: number }>()
  for (const r of rows) {
    const { id, name } = keyOf(r)
    const key = id ?? `∅:${name}`
    const g = map.get(key) ?? { id, name, minutes: 0, billableMinutes: 0, amount: 0 }
    g.minutes += r.duration_minutes
    if (r.billable) {
      g.billableMinutes += r.duration_minutes
      g.amount += (r.duration_minutes / 60) * Number(r.rate_snapshot ?? 0)
    }
    map.set(key, g)
  }
  return [...map.values()]
    .map((g) => ({
      id: g.id,
      name: g.name,
      hours: round2(g.minutes / 60),
      billable_hours: round2(g.billableMinutes / 60),
      amount: round2(g.amount),
    }))
    .sort((a, b) => b.hours - a.hours)
}

export function summariseTime(rows: TimeEntryLedgerRow[]): TimeSummary {
  let minutes = 0
  let billableMinutes = 0
  let amount = 0
  let unbilled = 0
  const byDay = new Map<string, { minutes: number; amount: number }>()
  for (const r of rows) {
    minutes += r.duration_minutes
    const day = byDay.get(r.entry_date) ?? { minutes: 0, amount: 0 }
    day.minutes += r.duration_minutes
    if (r.billable) {
      billableMinutes += r.duration_minutes
      const value = (r.duration_minutes / 60) * Number(r.rate_snapshot ?? 0)
      amount += value
      day.amount += value
      if (!r.billed) unbilled += value
    }
    byDay.set(r.entry_date, day)
  }
  return {
    total_hours: round2(minutes / 60),
    billable_hours: round2(billableMinutes / 60),
    non_billable_hours: round2((minutes - billableMinutes) / 60),
    amount: round2(amount),
    unbilled_amount: round2(unbilled),
    entry_count: rows.length,
    by_project: groupBy(rows, (r) => ({ id: r.project_id, name: r.project?.name ?? 'No project' })),
    by_person: groupBy(rows, (r) => ({ id: r.person_id ?? null, name: r.person?.full_name ?? 'Unattributed' })),
    by_task: groupBy(rows, (r) => ({ id: r.task_id ?? null, name: r.task?.title ?? 'No task' })).slice(0, 10),
    by_engagement: groupBy(rows, (r) => ({
      id: r.engagement_id ?? null,
      name: r.engagement ? (r.engagement.code ?? r.engagement.name) : 'No engagement',
    })),
    by_day: [...byDay.entries()]
      .map(([date, d]) => ({ date, hours: round2(d.minutes / 60), amount: round2(d.amount) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export interface BillingMonthBucket {
  period: BillingPeriod
  rows: TimeEntryLedgerRow[]
  summary: TimeSummary
}

/**
 * Bucket rows into the engagement's billing months. Applies the pre-start rule
 * exactly as engagement_period_start() does in SQL: an entry dated before
 * start_date folds into the first billing month, so this matches
 * engagement_hours_by_month for the same rows. Newest period first.
 */
export function bucketByBillingMonth(rows: TimeEntryLedgerRow[], basis: BillingPeriodBasis): BillingMonthBucket[] {
  const map = new Map<string, TimeEntryLedgerRow[]>()
  for (const r of rows) {
    const start = billingPeriodStartFor(r.entry_date, basis)
    const list = map.get(start) ?? []
    list.push(r)
    map.set(start, list)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([start, bucketRows]) => ({
      period: billingPeriodFromStart(start, basis),
      rows: bucketRows,
      summary: summariseTime(bucketRows),
    }))
}
