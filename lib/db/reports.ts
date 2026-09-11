import { createClient } from '@/lib/supabase/server'
import { summariseTime, bucketByBillingMonth } from '@/lib/time/summary'
import { formatBillingPeriod } from '@/lib/engagements/periods'
import type { TimeEntryLedgerRow } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

/** Raw, completed (non-running) time rows in a date range, ledger-shaped. */
async function timeRows(from: string, to: string, client?: SupabaseClient): Promise<TimeEntryLedgerRow[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('time_entries')
    .select(
      '*, engagement:engagements(id, code, name), person:people(id, full_name), project:projects(id, name), task:engagement_tasks(id, title)'
    )
    .eq('is_running', false)
    .gte('entry_date', from)
    .lte('entry_date', to)
  if (error) throw new Error(error.message || 'Failed to load time entries')
  return (data ?? []) as unknown as TimeEntryLedgerRow[]
}

export interface HoursByEngagementRow {
  engagement_id: string | null
  engagement_name: string
  engagement_code: string | null
  total_hours: number
  billable_hours: number
  total_cost: number
  by_project: Array<{ id: string | null; name: string; hours: number; billable_hours: number; amount: number }>
  by_person: Array<{ id: string | null; name: string; hours: number; billable_hours: number; amount: number }>
  /** Billing-month buckets (the engagement's own anchor day) for the range. */
  months: Array<{ period_start: string; period_end: string; label: string; hours: number; billable_hours: number; amount: number; included: number | null }>
}

export async function hoursByEngagement(from: string, to: string, client?: SupabaseClient): Promise<HoursByEngagementRow[]> {
  const supabase = await getSupabase(client)
  const rows = await timeRows(from, to, supabase)

  // Group entries per engagement, then run the one shared maths per group.
  const byEng = new Map<string, TimeEntryLedgerRow[]>()
  for (const r of rows) {
    const key = r.engagement_id ?? 'none'
    const list = byEng.get(key) ?? []
    list.push(r)
    byEng.set(key, list)
  }

  // Billing bases for the month buckets.
  const engIds = [...byEng.keys()].filter((k) => k !== 'none')
  const bases = new Map<string, { start_date: string | null; billing_month_start_day: number | null; included_hours_monthly: number | null }>()
  if (engIds.length) {
    const { data } = await supabase
      .from('engagements')
      .select('id, start_date, billing_month_start_day, included_hours_monthly')
      .in('id', engIds)
    for (const e of (data ?? []) as Array<{ id: string; start_date: string | null; billing_month_start_day: number | null; included_hours_monthly: number | null }>) {
      bases.set(e.id, e)
    }
  }

  return [...byEng.entries()]
    .map(([key, groupRows]) => {
      const s = summariseTime(groupRows)
      const first = groupRows[0]
      const basis = key === 'none' ? null : bases.get(key) ?? null
      const months = bucketByBillingMonth(groupRows, {
        start_date: basis?.start_date ?? null,
        billing_month_start_day: basis?.billing_month_start_day ?? 1,
      }).map((b) => ({
        period_start: b.period.start,
        period_end: b.period.end,
        label: formatBillingPeriod(b.period, { year: true }),
        hours: b.summary.total_hours,
        billable_hours: b.summary.billable_hours,
        amount: b.summary.amount,
        included: basis?.included_hours_monthly ?? null,
      }))
      return {
        engagement_id: key === 'none' ? null : key,
        engagement_name: first.engagement?.name ?? 'No engagement',
        engagement_code: first.engagement?.code ?? null,
        total_hours: s.total_hours,
        billable_hours: s.billable_hours,
        total_cost: s.amount,
        by_project: s.by_project,
        by_person: s.by_person,
        months,
      }
    })
    .sort((a, b) => b.total_cost - a.total_cost)
}

export interface PersonEngagementBreakdown {
  engagement_name: string
  hours: number
  billable_hours: number
  cost: number
}

export interface HoursByPersonRow {
  person_id: string | null
  person_name: string
  total_hours: number
  billable_hours: number
  total_cost: number
  byEngagement: PersonEngagementBreakdown[]
}

export async function hoursByPerson(from: string, to: string, client?: SupabaseClient): Promise<HoursByPersonRow[]> {
  const rows = await timeRows(from, to, client)
  const byPerson = new Map<string, TimeEntryLedgerRow[]>()
  for (const r of rows) {
    const key = r.person_id ?? 'none'
    const list = byPerson.get(key) ?? []
    list.push(r)
    byPerson.set(key, list)
  }
  return [...byPerson.entries()]
    .map(([key, groupRows]) => {
      const s = summariseTime(groupRows)
      return {
        person_id: key === 'none' ? null : key,
        person_name: groupRows[0].person?.full_name ?? 'Unattributed',
        total_hours: s.total_hours,
        billable_hours: s.billable_hours,
        total_cost: s.amount,
        byEngagement: s.by_engagement.map((g) => ({
          engagement_name: g.name,
          hours: g.hours,
          billable_hours: g.billable_hours,
          cost: g.amount,
        })),
      }
    })
    .sort((a, b) => b.total_hours - a.total_hours)
}
