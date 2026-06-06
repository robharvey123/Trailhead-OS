import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

// ── Period helpers (Europe/London, hardcoded per brief) ───────────────────────

const LONDON = 'Europe/London'

/** Today's calendar date in London, as a UTC Date at that date's midnight. */
function londonToday(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${ymd}T00:00:00Z`)
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Monday–Sunday for the week `offsetWeeks` from the current London week. */
export function londonWeekRange(offsetWeeks = 0): { start: string; end: string } {
  const base = londonToday()
  const dow = base.getUTCDay() // 0=Sun … 6=Sat
  const mondayDelta = dow === 0 ? -6 : 1 - dow
  const monday = new Date(base)
  monday.setUTCDate(base.getUTCDate() + mondayDelta + offsetWeeks * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: iso(monday), end: iso(sunday) }
}

/** Calendar month for `offsetMonths` from the current London month. */
export function londonMonthRange(offsetMonths = 0): { start: string; end: string } {
  const base = londonToday()
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offsetMonths, 1))
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offsetMonths + 1, 0))
  return { start: iso(first), end: iso(last) }
}

/** Inclusive count of Mon–Fri between two ISO dates. */
function workingDays(startIso: string, endIso: string): number {
  let count = 0
  const cur = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  while (cur <= end) {
    const d = cur.getUTCDay()
    if (d !== 0 && d !== 6) count += 1
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

function hoursOf(minutes: number | null | undefined): number {
  return Math.round(((minutes ?? 0) / 60) * 100) / 100
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// ── Shared per-engagement report data ─────────────────────────────────────────

export interface ReportTimeEntry {
  work_date: string
  hours: number
  notes: string | null
  billable: boolean
  rate: number
  value: number
  person_full_name: string | null
  engagement_task: { id: string; title: string } | null
  project: { id: string; name: string } | null
}

export interface ReportData {
  engagement: {
    id: string
    name: string
    code: string | null
    end_client: string | null
    billed_via: string | null
    currency: string
    day_rate: number | null
    retainer: number | null
    included_hours: number | null
    is_billable: boolean
  }
  period: { start: string; end: string; working_days: number }
  time_entries: ReportTimeEntry[]
  tasks_completed: Array<{
    id: string
    title: string
    description: string | null
    completed_at: string | null
    assignee_full_name: string | null
    project_name: string | null
  }>
  hours_summary: {
    total: number
    billable: number
    non_billable: number
    by_person: Array<{ name: string; hours: number }>
    by_project: Array<{ name: string; hours: number }>
    by_day: Array<{ date: string; hours: number }>
  }
  totals: {
    hours: number
    value_gbp: number
    vs_retainer_hours?: number
    vs_retainer_pct?: number
  }
}

const TE_SELECT =
  'entry_date, duration_minutes, billable, rate_snapshot, description, person:people(full_name), project:projects(id, name), task:engagement_tasks(id, title)'

/**
 * One query bundle of everything a report (PDF, XLSX, LLM) needs for an
 * engagement over a period. Both artifacts render from this single object so
 * their numbers always agree.
 */
export async function gatherReportData(
  engagementId: string,
  periodStart: string,
  periodEnd: string,
  client?: SupabaseClient
): Promise<ReportData> {
  const supabase = await getSupabase(client)

  const { data: eng, error: engErr } = await supabase
    .from('engagements')
    .select(
      'id, name, code, currency, day_rate, retainer_amount_monthly, included_hours_monthly, is_billable, end_client:accounts!end_client_account_id(name), billed_via:accounts!billed_via_account_id(name)'
    )
    .eq('id', engagementId)
    .maybeSingle()
  if (engErr) throw new Error(engErr.message || 'Failed to load engagement')
  if (!eng) throw new Error(`Engagement not found: ${engagementId}`)

  const [entriesRes, tasksRes] = await Promise.all([
    supabase
      .from('time_entries')
      .select(TE_SELECT)
      .eq('engagement_id', engagementId)
      .eq('is_running', false)
      .gte('entry_date', periodStart)
      .lte('entry_date', periodEnd)
      .order('entry_date', { ascending: true }),
    supabase
      .from('engagement_tasks')
      .select('id, title, description, completed_at, project:projects(name), assignee:people!assignee_person_id(full_name)')
      .eq('engagement_id', engagementId)
      .eq('status', 'done')
      .gte('completed_at', `${periodStart}T00:00:00`)
      .lte('completed_at', `${periodEnd}T23:59:59`),
  ])
  if (entriesRes.error) throw new Error(entriesRes.error.message || 'Failed to load time entries')
  if (tasksRes.error) throw new Error(tasksRes.error.message || 'Failed to load completed tasks')

  type RawEntry = {
    entry_date: string
    duration_minutes: number | null
    billable: boolean
    rate_snapshot: number | null
    description: string | null
    person: { full_name: string } | { full_name: string }[] | null
    project: { id: string; name: string } | { id: string; name: string }[] | null
    task: { id: string; title: string } | { id: string; title: string }[] | null
  }

  const time_entries: ReportTimeEntry[] = (entriesRes.data as unknown as RawEntry[]).map((r) => {
    const hours = hoursOf(r.duration_minutes)
    const rate = Number(r.rate_snapshot ?? 0)
    const person = firstRelation(r.person)
    const project = firstRelation(r.project)
    const task = firstRelation(r.task)
    return {
      work_date: r.entry_date,
      hours,
      notes: r.description,
      billable: r.billable,
      rate,
      value: r.billable ? Math.round(hours * rate * 100) / 100 : 0,
      person_full_name: person?.full_name ?? null,
      engagement_task: task ? { id: task.id, title: task.title } : null,
      project: project ? { id: project.id, name: project.name } : null,
    }
  })

  type RawTask = {
    id: string
    title: string
    description: string | null
    completed_at: string | null
    project: { name: string } | { name: string }[] | null
    assignee: { full_name: string } | { full_name: string }[] | null
  }
  const tasks_completed = (tasksRes.data as unknown as RawTask[]).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    completed_at: t.completed_at,
    assignee_full_name: firstRelation(t.assignee)?.full_name ?? null,
    project_name: firstRelation(t.project)?.name ?? null,
  }))

  // Aggregations
  const total = round2(time_entries.reduce((s, e) => s + e.hours, 0))
  const billable = round2(time_entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0))
  const value_gbp = round2(time_entries.reduce((s, e) => s + e.value, 0))

  const by_person = groupHours(time_entries, (e) => e.person_full_name ?? 'Unattributed')
  const by_project = groupHours(time_entries, (e) => e.project?.name ?? 'No project')
  const by_day = groupHours(time_entries, (e) => e.work_date)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => ({ date: d.name, hours: d.hours }))

  const includedHours = eng.included_hours_monthly as number | null
  const totals: ReportData['totals'] = { hours: total, value_gbp }
  if (includedHours != null) {
    totals.vs_retainer_hours = includedHours
    totals.vs_retainer_pct = includedHours > 0 ? Math.round((total / includedHours) * 100) : 0
  }

  return {
    engagement: {
      id: eng.id as string,
      name: eng.name as string,
      code: (eng.code as string | null) ?? null,
      end_client: firstRelation(eng.end_client as { name: string } | { name: string }[] | null)?.name ?? null,
      billed_via: firstRelation(eng.billed_via as { name: string } | { name: string }[] | null)?.name ?? null,
      currency: (eng.currency as string) ?? 'GBP',
      day_rate: (eng.day_rate as number | null) ?? null,
      retainer: (eng.retainer_amount_monthly as number | null) ?? null,
      included_hours: includedHours,
      is_billable: Boolean(eng.is_billable),
    },
    period: { start: periodStart, end: periodEnd, working_days: workingDays(periodStart, periodEnd) },
    time_entries,
    tasks_completed,
    hours_summary: { total, billable, non_billable: round2(total - billable), by_person, by_project, by_day },
    totals,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function groupHours(entries: ReportTimeEntry[], key: (e: ReportTimeEntry) => string) {
  const map = new Map<string, number>()
  for (const e of entries) map.set(key(e), (map.get(key(e)) ?? 0) + e.hours)
  return [...map.entries()].map(([name, hours]) => ({ name, hours: round2(hours) })).sort((a, b) => b.hours - a.hours)
}

// ── Internal weekly scan (cross-engagement) ───────────────────────────────────

export interface InternalWeeklyProjectRow {
  project_id: string | null
  project_name: string
  hours: number
  billable_hours: number
  value: number
}

export interface InternalWeeklyEngagementRow {
  engagement_id: string
  engagement_name: string
  currency: string
  is_billable: boolean
  hours: number
  billable_hours: number
  value: number
  projects: InternalWeeklyProjectRow[]
}

export interface InternalWeeklyReport {
  weekStart: string
  weekEnd: string
  offsetWeeks: number
  totalHours: number
  totalValue: number
  engagements: InternalWeeklyEngagementRow[]
}

/**
 * Your own quick scan: all engagement-linked time for a week, grouped by
 * engagement then project. Non-engagement time is excluded.
 */
export async function getInternalWeeklyReport(
  offsetWeeks = 0,
  client?: SupabaseClient
): Promise<InternalWeeklyReport> {
  const supabase = await getSupabase(client)
  const { start, end } = londonWeekRange(offsetWeeks)

  const { data, error } = await supabase
    .from('time_entries')
    .select(
      'duration_minutes, billable, rate_snapshot, engagement_id, project_id, engagement:engagements(id, name, currency, is_billable), project:projects(id, name)'
    )
    .eq('is_running', false)
    .not('engagement_id', 'is', null)
    .gte('entry_date', start)
    .lte('entry_date', end)
  if (error) throw new Error(error.message || 'Failed to load weekly time entries')

  type Row = {
    duration_minutes: number | null
    billable: boolean
    rate_snapshot: number | null
    engagement_id: string
    project_id: string | null
    engagement: { id: string; name: string; currency: string; is_billable: boolean } | { id: string; name: string; currency: string; is_billable: boolean }[] | null
    project: { id: string; name: string } | { id: string; name: string }[] | null
  }

  const engMap = new Map<string, InternalWeeklyEngagementRow>()
  const projMap = new Map<string, Map<string, InternalWeeklyProjectRow>>()

  for (const r of (data as unknown as Row[])) {
    const eng = firstRelation(r.engagement)
    if (!eng) continue
    const hours = hoursOf(r.duration_minutes)
    const value = r.billable ? hours * Number(r.rate_snapshot ?? 0) : 0

    let engRow = engMap.get(eng.id)
    if (!engRow) {
      engRow = {
        engagement_id: eng.id,
        engagement_name: eng.name,
        currency: eng.currency ?? 'GBP',
        is_billable: Boolean(eng.is_billable),
        hours: 0,
        billable_hours: 0,
        value: 0,
        projects: [],
      }
      engMap.set(eng.id, engRow)
      projMap.set(eng.id, new Map())
    }
    engRow.hours += hours
    if (r.billable) engRow.billable_hours += hours
    engRow.value += value

    const project = firstRelation(r.project)
    const pKey = project?.id ?? '∅'
    const projects = projMap.get(eng.id)!
    let pRow = projects.get(pKey)
    if (!pRow) {
      pRow = { project_id: project?.id ?? null, project_name: project?.name ?? 'No project', hours: 0, billable_hours: 0, value: 0 }
      projects.set(pKey, pRow)
    }
    pRow.hours += hours
    if (r.billable) pRow.billable_hours += hours
    pRow.value += value
  }

  const engagements = [...engMap.values()]
    .map((e) => ({
      ...e,
      hours: round2(e.hours),
      billable_hours: round2(e.billable_hours),
      value: round2(e.value),
      projects: [...projMap.get(e.engagement_id)!.values()]
        .map((p) => ({ ...p, hours: round2(p.hours), billable_hours: round2(p.billable_hours), value: round2(p.value) }))
        .sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.hours - a.hours)

  return {
    weekStart: start,
    weekEnd: end,
    offsetWeeks,
    totalHours: round2(engagements.reduce((s, e) => s + e.hours, 0)),
    totalValue: round2(engagements.reduce((s, e) => s + e.value, 0)),
    engagements,
  }
}
