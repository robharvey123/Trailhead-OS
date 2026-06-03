import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

/** Raw, completed (non-running) time rows in a date range, with engagement + person names. */
async function timeRows(from: string, to: string, client?: SupabaseClient) {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('time_entries')
    .select('duration_minutes, billable, rate_snapshot, engagement_id, person_id, engagement:engagements(name), person:people(full_name)')
    .eq('is_running', false)
    .gte('entry_date', from)
    .lte('entry_date', to)
  if (error) throw new Error(error.message || 'Failed to load time entries')
  return (data ?? []) as unknown as Array<{
    duration_minutes: number
    billable: boolean
    rate_snapshot: number | null
    engagement_id: string | null
    person_id: string | null
    engagement: { name: string } | null
    person: { full_name: string } | null
  }>
}

export interface HoursByEngagementRow {
  engagement_id: string | null
  engagement_name: string
  total_hours: number
  billable_hours: number
  total_cost: number
}

export async function hoursByEngagement(from: string, to: string, client?: SupabaseClient): Promise<HoursByEngagementRow[]> {
  const rows = await timeRows(from, to, client)
  const map = new Map<string, HoursByEngagementRow>()
  for (const r of rows) {
    const key = r.engagement_id ?? 'none'
    const hrs = (r.duration_minutes ?? 0) / 60
    const row =
      map.get(key) ??
      { engagement_id: r.engagement_id, engagement_name: r.engagement?.name ?? 'No engagement', total_hours: 0, billable_hours: 0, total_cost: 0 }
    row.total_hours += hrs
    if (r.billable) row.billable_hours += hrs
    row.total_cost += hrs * Number(r.rate_snapshot ?? 0)
    map.set(key, row)
  }
  return Array.from(map.values()).sort((a, b) => b.total_cost - a.total_cost)
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
  const people = new Map<string, HoursByPersonRow & { _eng: Map<string, PersonEngagementBreakdown> }>()
  for (const r of rows) {
    const key = r.person_id ?? 'none'
    const hrs = (r.duration_minutes ?? 0) / 60
    const cost = hrs * Number(r.rate_snapshot ?? 0)
    const person =
      people.get(key) ??
      {
        person_id: r.person_id,
        person_name: r.person?.full_name ?? 'Unattributed',
        total_hours: 0,
        billable_hours: 0,
        total_cost: 0,
        byEngagement: [],
        _eng: new Map<string, PersonEngagementBreakdown>(),
      }
    person.total_hours += hrs
    if (r.billable) person.billable_hours += hrs
    person.total_cost += cost

    const engName = r.engagement?.name ?? 'No engagement'
    const eng = person._eng.get(engName) ?? { engagement_name: engName, hours: 0, billable_hours: 0, cost: 0 }
    eng.hours += hrs
    if (r.billable) eng.billable_hours += hrs
    eng.cost += cost
    person._eng.set(engName, eng)

    people.set(key, person)
  }
  return Array.from(people.values())
    .map(({ _eng, ...p }) => ({ ...p, byEngagement: Array.from(_eng.values()).sort((a, b) => b.hours - a.hours) }))
    .sort((a, b) => b.total_hours - a.total_hours)
}
