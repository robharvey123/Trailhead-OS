import { createClient } from '@/lib/supabase/server'
import { toClientSafeTask, resolveTimeEntryDescription, type ClientSafeTask } from '@/lib/engagements/client-safe'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

/**
 * The factual spine of a reporting period — deterministic and reproducible. Task
 * state is reconstructed from engagement_task_activity (the immutable history),
 * NEVER from engagement_tasks.status/completed_at (mutable caches), so a report
 * regenerated months later for the same period returns identical content.
 * Contains no AI and no leaky fields (task arrays pass the client-safe projection).
 */

const IN_PROGRESS_STATUSES = new Set(['in_progress', 'review'])
const COMPLETED_STATUS = 'done'
const DEAD_STATUSES = new Set(['done', 'cancelled'])
const DEFAULT_LOOKAHEAD_DAYS = 7

export type SpineCompletedTask = ClientSafeTask & { completed_at: string; reopened: boolean }
export type SpineInProgressTask = ClientSafeTask & { started_at: string | null }

export type EngagementPeriodSpine = {
  engagement: { code: string | null; name: string; period_start: string; period_end: string }
  completed: SpineCompletedTask[]
  in_progress: SpineInProgressTask[]
  scheduled_next: ClientSafeTask[]
  slipped: ClientSafeTask[]
  unattributed: { count: number; hours: number }
  hours: {
    used_in_period: number
    // One row per calendar month the period touches, so a week straddling a
    // month end reports each month against its own allowance rather than
    // collapsing to the month of periodEnd.
    months: Array<{ month: string; used: number; included: number | null; over: number }>
  }
  tier1_movements: { account_name: string; gate: string; date: string }[]
  tier1_position: { account_name: string; gates_set: number; is_complete: boolean }[]
  meetings: { date: string; title: string; attendees_summary: string }[]
  risks: { raised_at: string; title: string; status: string; detail: string | null }[]
}

// ── Pure date helpers (no now(), so the spine is time-invariant) ──────────────

/** Date portion of an ISO timestamp/date — ISO strings sort lexicographically. */
function dateOf(ts: string | null | undefined): string {
  return (ts ?? '').slice(0, 10)
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Task state reconstruction (history only) ──────────────────────────────────

export type TaskRow = {
  id: string
  title: string
  description: string | null
  client_description: string | null
  due_date: string | null
  created_at: string
}
export type StatusTransition = { to: string; from: string | null; created_at: string }

/** Status as at `at`, from the transition history alone. The first transition's
 * `from` is the true creation status; 'backlog' (the schema default) if none. */
export function reconstructStatusAsAt(transitions: StatusTransition[], at: string): string {
  const sorted = [...transitions].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const initial = sorted.length ? sorted[0].from ?? 'backlog' : 'backlog'
  let state = initial
  for (const t of sorted) {
    if (dateOf(t.created_at) <= at) state = t.to
    else break
  }
  return state
}

function completingTransitionInPeriod(
  transitions: StatusTransition[],
  periodStart: string,
  periodEnd: string
): StatusTransition | null {
  const within = transitions
    .filter((t) => dateOf(t.created_at) >= periodStart && dateOf(t.created_at) <= periodEnd)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const last = within[within.length - 1]
  return last && last.to === COMPLETED_STATUS ? last : null
}

function firstStartedAt(transitions: StatusTransition[]): string | null {
  const started = transitions
    .filter((t) => IN_PROGRESS_STATUSES.has(t.to))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  return started ? dateOf(started.created_at) : null
}

export type TaskBuckets = {
  completed: SpineCompletedTask[]
  in_progress: SpineInProgressTask[]
  scheduled_next: ClientSafeTask[]
  slipped: ClientSafeTask[]
}

/**
 * Pure bucketing of tasks for a period from their history. Reads only due_date,
 * created_at and the transition list — never a task's current status column — so
 * mutating current status without changing history yields identical output.
 */
export function deriveTaskBuckets(
  tasks: TaskRow[],
  transitionsByTask: Map<string, StatusTransition[]>,
  periodStart: string,
  periodEnd: string,
  lookaheadDays = DEFAULT_LOOKAHEAD_DAYS
): TaskBuckets {
  const scheduledUntil = addDaysIso(periodEnd, lookaheadDays)
  const completed: SpineCompletedTask[] = []
  const in_progress: SpineInProgressTask[] = []
  const scheduled_next: ClientSafeTask[] = []
  const slipped: ClientSafeTask[] = []

  for (const task of tasks) {
    if (dateOf(task.created_at) > periodEnd) continue // did not exist yet
    const transitions = transitionsByTask.get(task.id) ?? []
    const safe = toClientSafeTask(task)

    const completing = completingTransitionInPeriod(transitions, periodStart, periodEnd)
    if (completing) {
      const reopened = transitions.some((t) => t.to === COMPLETED_STATUS && dateOf(t.created_at) < periodStart)
      completed.push({ ...safe, completed_at: dateOf(completing.created_at), reopened })
      continue
    }

    const state = reconstructStatusAsAt(transitions, periodEnd)
    if (DEAD_STATUSES.has(state)) continue // done in an earlier period, or cancelled

    const pastDue = task.due_date != null && task.due_date <= periodEnd
    if (pastDue) {
      // Slipped is its own bucket and takes precedence over in_progress — never hide slippage.
      slipped.push(safe)
      continue
    }
    if (IN_PROGRESS_STATUSES.has(state)) {
      in_progress.push({ ...safe, started_at: firstStartedAt(transitions) })
      continue
    }
    if (state === 'backlog' && task.due_date != null && task.due_date > periodEnd && task.due_date <= scheduledUntil) {
      scheduled_next.push(safe)
    }
  }

  // Stable ordering for byte-identical output.
  const byTitle = (a: ClientSafeTask, b: ClientSafeTask) => a.title.localeCompare(b.title)
  completed.sort((a, b) => a.completed_at.localeCompare(b.completed_at) || byTitle(a, b))
  in_progress.sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? '') || byTitle(a, b))
  scheduled_next.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || byTitle(a, b))
  slipped.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || byTitle(a, b))
  return { completed, in_progress, scheduled_next, slipped }
}

// ── The builder ───────────────────────────────────────────────────────────────

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

type EngRow = {
  id: string
  code: string | null
  name: string
  included_hours_monthly: number | null
  end_client_account_id: string | null
  billed_via_account_id: string | null
}

export async function buildEngagementPeriodReport(
  engagementRef: string,
  periodStart: string,
  periodEnd: string,
  opts: { lookaheadDays?: number } = {},
  client?: SupabaseClient
): Promise<EngagementPeriodSpine> {
  const supabase = await getSupabase(client)

  const engQuery = supabase
    .from('engagements')
    .select('id, code, name, included_hours_monthly, end_client_account_id, billed_via_account_id')
  const { data: eng, error: engErr } = await (isUuid(engagementRef)
    ? engQuery.eq('id', engagementRef)
    : engQuery.eq('code', engagementRef)
  ).maybeSingle()
  if (engErr) throw new Error(engErr.message || 'Failed to load engagement')
  if (!eng) throw new Error(`Engagement not found: ${engagementRef}`)
  const e = eng as EngRow

  // Fetch time entries from the start of the period's first calendar month
  // through periodEnd. That covers every month the period touches, bounded by
  // periodEnd so the figures stay time-invariant (no hours logged after the
  // period can move a past report).
  const firstMonthStart = `${periodStart.slice(0, 7)}-01`

  // Client accounts for the Granola join. Empty in.() is a 400, so fall back to a
  // no-match sentinel when the engagement has neither account set.
  const clientAccountIds = [e.end_client_account_id, e.billed_via_account_id].filter(Boolean) as string[]
  const granolaAccounts = clientAccountIds.length ? clientAccountIds : ['00000000-0000-0000-0000-000000000000']

  const [tasksRes, entriesRes, tier1Res, calRes, granolaRes, risksRes] = await Promise.all([
    // Client-visible tasks only — internal rows never enter a client report.
    supabase
      .from('engagement_tasks')
      .select('id, title, description, client_description, due_date, created_at')
      .eq('engagement_id', e.id)
      .eq('client_visible', true),
    supabase
      .from('time_entries')
      .select('entry_date, duration_minutes, client_description, description, task:engagement_tasks(title, client_description)')
      .eq('engagement_id', e.id)
      .eq('is_running', false)
      .gte('entry_date', firstMonthStart)
      .lte('entry_date', periodEnd),
    supabase
      .from('tier1_milestones')
      .select('account_id, range_review_decided_at, go_live_confirmed_at, first_po_received_at, is_complete, account:accounts(name)')
      .eq('engagement_id', e.id),
    supabase
      .from('calendar_events')
      .select('title, start_at, contact:contacts(name)')
      .eq('engagement_id', e.id)
      .gte('start_at', `${periodStart}T00:00:00`)
      .lte('start_at', `${periodEnd}T23:59:59`),
    supabase
      .from('meetings')
      .select('title, meeting_date, attendees, account_id')
      .in('account_id', granolaAccounts),
    supabase
      .from('engagement_risks')
      .select('title, detail, status, raised_at, closed_at')
      .eq('engagement_id', e.id),
  ])
  if (tasksRes.error) throw new Error(tasksRes.error.message)

  const tasks = (tasksRes.data ?? []) as TaskRow[]
  const taskIds = tasks.map((t) => t.id)

  // Transition history for those tasks.
  const transitionsByTask = new Map<string, StatusTransition[]>()
  if (taskIds.length) {
    const { data: acts } = await supabase
      .from('engagement_task_activity')
      .select('task_id, payload, created_at')
      .eq('kind', 'status_changed')
      .in('task_id', taskIds)
    for (const a of (acts ?? []) as Array<{ task_id: string; payload: { from?: string; to?: string }; created_at: string }>) {
      if (!a.payload?.to) continue
      const list = transitionsByTask.get(a.task_id) ?? []
      list.push({ to: a.payload.to, from: a.payload.from ?? null, created_at: a.created_at })
      transitionsByTask.set(a.task_id, list)
    }
  }

  const buckets = deriveTaskBuckets(tasks, transitionsByTask, periodStart, periodEnd, opts.lookaheadDays)

  // Hours (no money). One fetch covers used_in_period, the per-month breakdown and
  // the unattributed tally.
  type EntryRow = {
    entry_date: string
    duration_minutes: number | null
    client_description: string | null
    description: string | null
    task: { title: string | null; client_description: string | null } | { title: string | null; client_description: string | null }[] | null
  }
  const entryRows = (entriesRes.data ?? []) as unknown as EntryRow[]
  const included_monthly = e.included_hours_monthly

  const monthUsed = new Map<string, number>()
  let periodMinutes = 0
  let unattributedCount = 0
  let unattributedMinutes = 0
  for (const r of entryRows) {
    const mins = r.duration_minutes ?? 0
    monthUsed.set(r.entry_date.slice(0, 7), (monthUsed.get(r.entry_date.slice(0, 7)) ?? 0) + mins)
    if (r.entry_date >= periodStart && r.entry_date <= periodEnd) {
      periodMinutes += mins
      const task = Array.isArray(r.task) ? r.task[0] : r.task
      const attributed = resolveTimeEntryDescription({
        entry_client_description: r.client_description,
        entry_description: r.description,
        task_client_description: task?.client_description ?? null,
        task_title: task?.title ?? null,
      }) !== null
      if (!attributed) {
        unattributedCount += 1
        unattributedMinutes += mins
      }
    }
  }
  const used_in_period = round2(periodMinutes / 60)
  // Every calendar month from the period's first month to periodEnd's month.
  const months: EngagementPeriodSpine['hours']['months'] = []
  let cursor = `${periodStart.slice(0, 7)}-01`
  const endMonth = periodEnd.slice(0, 7)
  while (cursor.slice(0, 7) <= endMonth) {
    const m = cursor.slice(0, 7)
    const used = round2((monthUsed.get(m) ?? 0) / 60)
    const over = included_monthly != null ? round2(Math.max(0, used - included_monthly)) : 0
    months.push({ month: m, used, included: included_monthly, over })
    cursor = addDaysIso(addDaysIso(cursor, 32).slice(0, 7) + '-01', 0)
  }

  // Tier 1.
  type Tier1 = {
    account_id: string
    range_review_decided_at: string | null
    go_live_confirmed_at: string | null
    first_po_received_at: string | null
    is_complete: boolean
    account: { name: string } | { name: string }[] | null
  }
  const gateLabels: Array<[keyof Tier1, string]> = [
    ['range_review_decided_at', 'Range review decided'],
    ['go_live_confirmed_at', 'Go-live confirmed'],
    ['first_po_received_at', 'First PO received'],
  ]
  const tier1_movements: EngagementPeriodSpine['tier1_movements'] = []
  const tier1_position: EngagementPeriodSpine['tier1_position'] = []
  for (const m of (tier1Res.data ?? []) as unknown as Tier1[]) {
    const name = (Array.isArray(m.account) ? m.account[0] : m.account)?.name ?? '—'
    let gatesSet = 0
    for (const [col, label] of gateLabels) {
      const val = m[col] as string | null
      if (val) {
        gatesSet += 1
        if (val >= periodStart && val <= periodEnd) tier1_movements.push({ account_name: name, gate: label, date: val })
      }
    }
    tier1_position.push({ account_name: name, gates_set: gatesSet, is_complete: Boolean(m.is_complete) })
  }
  tier1_movements.sort((a, b) => a.date.localeCompare(b.date) || a.account_name.localeCompare(b.account_name))
  tier1_position.sort((a, b) => a.account_name.localeCompare(b.account_name))

  // Meetings — calendar events on this engagement, unioned with Granola meetings
  // on the engagement's client accounts, deduped by (date, title). No fabrication.
  const meetingMap = new Map<string, { date: string; title: string; attendees_summary: string }>()
  for (const c of (calRes.data ?? []) as unknown as Array<{ title: string; start_at: string; contact: { name: string } | { name: string }[] | null }>) {
    const contact = Array.isArray(c.contact) ? c.contact[0] : c.contact
    const date = dateOf(c.start_at)
    meetingMap.set(`${date}|${c.title}`, { date, title: c.title, attendees_summary: contact?.name ?? '' })
  }
  for (const g of (granolaRes.data ?? []) as unknown as Array<{ title: string; meeting_date: string | null; attendees: Array<{ name?: string }> | null }>) {
    if (!g.meeting_date) continue
    const date = dateOf(g.meeting_date)
    if (date < periodStart || date > periodEnd) continue
    const key = `${date}|${g.title}`
    if (meetingMap.has(key)) continue
    const names = (g.attendees ?? []).map((a) => a?.name).filter(Boolean).join(', ')
    meetingMap.set(key, { date, title: g.title, attendees_summary: names })
  }
  const meetings = [...meetingMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

  // Risks: open at any point during the period, or closed within it.
  const risks = ((risksRes.data ?? []) as Array<{ title: string; detail: string | null; status: string; raised_at: string; closed_at: string | null }>)
    .filter((r) => dateOf(r.raised_at) <= periodEnd && (r.closed_at == null || dateOf(r.closed_at) >= periodStart))
    .map((r) => ({ raised_at: dateOf(r.raised_at), title: r.title, status: r.status, detail: r.detail }))
    .sort((a, b) => a.raised_at.localeCompare(b.raised_at) || a.title.localeCompare(b.title))

  return {
    engagement: { code: e.code, name: e.name, period_start: periodStart, period_end: periodEnd },
    completed: buckets.completed,
    in_progress: buckets.in_progress,
    scheduled_next: buckets.scheduled_next,
    slipped: buckets.slipped,
    unattributed: { count: unattributedCount, hours: round2(unattributedMinutes / 60) },
    hours: { used_in_period, months },
    tier1_movements,
    tier1_position,
    meetings,
    risks,
  }
}
