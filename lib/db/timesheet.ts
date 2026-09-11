import type { SupabaseClient as SupabaseJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { TimeEntry, TimeEntryLedgerRow, UnbilledTimeGroup } from '@/lib/types'
import { resolveTimeLinks, TimeLinkConflict } from '@/lib/time/links'
import { summariseTicket } from '@/lib/tickets/summarise'

/** Relations the shared ledger (engagement Time tab, project Time panel) renders. */
export const TIME_LEDGER_SELECT =
  '*, project:projects(id, name), task:engagement_tasks(id, title), person:people(id, full_name), engagement:engagements(id, code, name), account:accounts(id, name), invoice:invoices(id, invoice_number)'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

interface TimeEntryFilters {
  account_id?: string
  project_id?: string
  engagement_id?: string
  engagement_ids?: string[]
  task_id?: string
  person_id?: string
  billed?: boolean
  date_from?: string
  date_to?: string
  billable?: boolean
  limit?: number
  offset?: number
}

export async function listTimeEntries(
  filters: TimeEntryFilters = {},
  client?: SupabaseClient
): Promise<TimeEntryLedgerRow[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('time_entries')
    .select(TIME_LEDGER_SELECT)
    .eq('is_running', false)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }

  if (filters.engagement_id) {
    query = query.eq('engagement_id', filters.engagement_id)
  }

  if (filters.engagement_ids?.length) {
    query = query.in('engagement_id', filters.engagement_ids)
  }

  if (filters.task_id) {
    query = query.eq('task_id', filters.task_id)
  }

  if (filters.person_id) {
    query = query.eq('person_id', filters.person_id)
  }

  if (typeof filters.billed === 'boolean') {
    query = query.eq('billed', filters.billed)
  }

  if (filters.date_from) {
    query = query.gte('entry_date', filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte('entry_date', filters.date_to)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  if (typeof filters.billable === 'boolean') {
    query = query.eq('billable', filters.billable)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load time entries')
  }

  return (data ?? []) as unknown as TimeEntryLedgerRow[]
}

export async function getTimeEntryById(
  id: string,
  client?: SupabaseClient
): Promise<TimeEntry | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load time entry')
  }

  return (data as TimeEntry | null) ?? null
}

export async function createTimeEntry(
  data: {
    account_id?: string | null
    project_id?: string | null
    engagement_id?: string | null
    task_id?: string | null
    person_id?: string | null
    entry_date?: string
    duration_minutes: number
    description?: string | null
    billable?: boolean
    rate_snapshot?: number
  },
  client?: SupabaseClient
): Promise<TimeEntry> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()

  if (!auth.data.user) {
    throw new Error('Not authenticated')
  }

  const userId = auth.data.user.id
  const entryDate = data.entry_date || new Date().toISOString().split('T')[0]

  const links = await resolveTimeLinks(
    { ...data, user_id: userId, billable: data.billable ?? null, rate_snapshot: data.rate_snapshot ?? null },
    supabase as unknown as SupabaseJsClient
  )

  const payload = {
    user_id: userId,
    person_id: links.person_id,
    account_id: links.account_id,
    project_id: links.project_id,
    engagement_id: links.engagement_id,
    task_id: links.task_id,
    entry_date: entryDate,
    start_at: null,
    end_at: null,
    duration_minutes: Math.round(data.duration_minutes),
    description: data.description?.trim() || null,
    billable: links.billable,
    rate_snapshot: links.rate_snapshot,
    currency_snapshot: 'GBP',
    source: 'manual' as const,
    is_running: false,
  }

  const { data: entry, error } = await supabase
    .from('time_entries')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create time entry')
  }

  return entry as TimeEntry
}

const LINK_FIELDS = ['task_id', 'project_id', 'engagement_id', 'account_id', 'person_id'] as const

export async function updateTimeEntry(
  id: string,
  data: Partial<TimeEntry>,
  client?: SupabaseClient
): Promise<TimeEntry> {
  const supabase = await getSupabase(client)

  const patch: Record<string, unknown> = {}

  // Link changes go through the resolver on the MERGED row so the same rules
  // apply as at create. Billed rows keep their links AND their invoiced rate.
  const touchesLinks = LINK_FIELDS.some((f) => f in data)
  if (touchesLinks) {
    const existing = await getTimeEntryById(id, supabase)
    if (!existing) throw new Error('Time entry not found')
    if (existing.billed) {
      throw new TimeLinkConflict('This entry is billed; unlink it from its invoice before changing where it is filed.')
    }
    const merged = {
      task_id: 'task_id' in data ? (data.task_id ?? null) : existing.task_id,
      project_id: 'project_id' in data ? (data.project_id ?? null) : existing.project_id,
      engagement_id: 'engagement_id' in data ? (data.engagement_id ?? null) : existing.engagement_id,
      account_id: 'account_id' in data ? (data.account_id ?? null) : existing.account_id,
      person_id: 'person_id' in data ? (data.person_id ?? null) : existing.person_id,
      user_id: existing.user_id,
      billable: 'billable' in data ? (data.billable ?? null) : null,
      rate_snapshot: 'rate_snapshot' in data ? (data.rate_snapshot ?? null) : null,
    }
    const links = await resolveTimeLinks(merged, supabase as unknown as SupabaseJsClient)
    patch.task_id = links.task_id
    patch.project_id = links.project_id
    patch.engagement_id = links.engagement_id
    patch.account_id = links.account_id
    patch.person_id = links.person_id
    // Re-resolve the rate only when the caller did not pin one explicitly.
    if (!('rate_snapshot' in data)) patch.rate_snapshot = links.rate_snapshot
  }

  if ('duration_minutes' in data && data.duration_minutes !== undefined) {
    patch.duration_minutes = Math.round(data.duration_minutes)
  }

  if ('description' in data) {
    patch.description = data.description?.trim() || null
  }

  if ('billable' in data && data.billable !== undefined) {
    patch.billable = data.billable
  }

  if ('rate_snapshot' in data && data.rate_snapshot !== undefined) {
    patch.rate_snapshot = data.rate_snapshot
  }

  if ('entry_date' in data && data.entry_date) {
    patch.entry_date = data.entry_date
  }

  const { data: entry, error } = await supabase
    .from('time_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update time entry')
  }

  return entry as TimeEntry
}

export async function deleteTimeEntry(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('time_entries').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete time entry')
  }
}

/**
 * Start a live timer for the authenticated user.
 * Only one timer can run per user at a time (enforced by unique index in DB).
 * If a timer is already running, it is returned instead.
 */
export async function startTimer(
  data: {
    account_id?: string | null
    project_id?: string | null
    engagement_id?: string | null
    task_id?: string | null
    description?: string | null
    billable?: boolean | null
  },
  client?: SupabaseClient
): Promise<TimeEntry> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()

  if (!auth.data.user) {
    throw new Error('Not authenticated')
  }

  const userId = auth.data.user.id

  // Check if a timer is already running
  const { data: runningEntry, error: selectError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('is_running', true)
    .maybeSingle()

  if (selectError) {
    throw new Error(selectError.message || 'Failed to check for running timer')
  }

  if (runningEntry) {
    return runningEntry as TimeEntry
  }

  // Create a new timer entry
  const now = new Date()
  const startAt = now.toISOString()
  const entryDate = now.toISOString().split('T')[0]

  // If the user didn't type a description and this timer is on a task (our
  // "ticket" board), pre-fill the description with a stripped-down summary of
  // the ticket. Runs server-side under the authed client so RLS applies.
  let description = data.description?.trim() || null
  if (!description && data.task_id) {
    const { data: ticket } = await supabase
      .from('engagement_tasks')
      .select('title, description')
      .eq('id', data.task_id)
      .maybeSingle()

    if (ticket) {
      const summary = summariseTicket({ title: ticket.title, body: ticket.description })
      description = summary || null
    }
  }

  const links = await resolveTimeLinks(
    { ...data, user_id: userId, billable: data.billable ?? null, rate_snapshot: null },
    supabase as unknown as SupabaseJsClient
  )

  const payload = {
    user_id: userId,
    person_id: links.person_id,
    account_id: links.account_id,
    project_id: links.project_id,
    engagement_id: links.engagement_id,
    task_id: links.task_id,
    entry_date: entryDate,
    start_at: startAt,
    end_at: null,
    duration_minutes: 0,
    description,
    billable: links.billable,
    rate_snapshot: 0, // Stamped on stop, when the final links are known.
    currency_snapshot: 'GBP',
    source: 'timer' as const,
    is_running: true,
  }

  const { data: entry, error } = await supabase
    .from('time_entries')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to start timer')
  }

  return entry as TimeEntry
}

export type StopTimerPatch = Partial<
  Pick<TimeEntry, 'description' | 'engagement_id' | 'project_id' | 'task_id' | 'account_id' | 'billable' | 'rate_snapshot'>
>

/**
 * Stop a running timer. The patch (all optional) is merged over the stored row
 * and the links re-resolved, so stop always snapshots the rate the final links
 * imply unless the caller pins one explicitly.
 */
export async function stopTimer(
  id: string,
  patch: StopTimerPatch = {},
  client?: SupabaseClient
): Promise<TimeEntry> {
  const supabase = await getSupabase(client)

  const { data: entry, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message || 'Failed to fetch timer')
  }

  if (!entry) {
    throw new Error('Timer not found')
  }

  if (!entry.start_at) {
    throw new Error('Timer has no start time')
  }

  const now = new Date()
  const endAt = now.toISOString()
  const startAt = new Date(entry.start_at)

  const durationMs = now.getTime() - startAt.getTime()
  // Floor of one minute: a timer that ran at all never records as zero.
  const durationMinutes = Math.max(durationMs > 0 ? 1 : 0, Math.round(durationMs / 60000))

  const links = await resolveTimeLinks(
    {
      task_id: 'task_id' in patch ? (patch.task_id ?? null) : entry.task_id,
      project_id: 'project_id' in patch ? (patch.project_id ?? null) : entry.project_id,
      engagement_id: 'engagement_id' in patch ? (patch.engagement_id ?? null) : entry.engagement_id,
      account_id: 'account_id' in patch ? (patch.account_id ?? null) : entry.account_id,
      person_id: entry.person_id,
      user_id: entry.user_id,
      billable: 'billable' in patch ? (patch.billable ?? null) : null,
      rate_snapshot: patch.rate_snapshot ?? null,
    },
    supabase as unknown as SupabaseJsClient
  )

  const { data: stopped, error: updateError } = await supabase
    .from('time_entries')
    .update({
      end_at: endAt,
      duration_minutes: durationMinutes,
      task_id: links.task_id,
      project_id: links.project_id,
      engagement_id: links.engagement_id,
      account_id: links.account_id,
      person_id: links.person_id,
      billable: 'billable' in patch ? (patch.billable ?? links.billable) : entry.source === 'timer' ? links.billable : entry.billable,
      rate_snapshot: links.rate_snapshot,
      description: 'description' in patch ? (patch.description?.trim() || null) : entry.description,
      is_running: false,
      entry_date: entry.entry_date,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) {
    throw new Error(updateError.message || 'Failed to stop timer')
  }

  return stopped as TimeEntry
}

export async function getRunningTimer(
  client?: SupabaseClient
): Promise<TimeEntryLedgerRow | null> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()

  if (!auth.data.user) {
    return null
  }

  const { data, error } = await supabase
    .from('time_entries')
    .select(TIME_LEDGER_SELECT)
    .eq('user_id', auth.data.user.id)
    .eq('is_running', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to fetch running timer')
  }

  return (data as unknown as TimeEntryLedgerRow | null) ?? null
}

export interface TaskTimeSummary {
  totalMinutes: number
  billableMinutes: number
  /** Per-person totals, minutes desc. personId is null for unattributed entries. */
  people: Array<{ personId: string | null; fullName: string; minutes: number }>
}

/**
 * Aggregate time logged on a task ACROSS ALL USERS, via the SECURITY DEFINER
 * task_time_summary() function (bypasses the own-scoped RLS). Use this for the
 * headline total / per-person breakdown so non-admins don't see a number that
 * silently omits other people's logged time. For the itemised list, use
 * listTaskTimeEntries (RLS-scoped) instead.
 */
export async function getTaskTimeSummary(taskId: string, client?: SupabaseClient): Promise<TaskTimeSummary> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.rpc('task_time_summary', { p_task_id: taskId })
  if (error) {
    throw new Error(error.message || 'Failed to load task time summary')
  }
  const rows = (data ?? []) as Array<{ person_id: string | null; full_name: string; minutes: number; billable_minutes: number }>
  return {
    totalMinutes: rows.reduce((s, r) => s + Number(r.minutes), 0),
    billableMinutes: rows.reduce((s, r) => s + Number(r.billable_minutes), 0),
    people: rows.map((r) => ({ personId: r.person_id, fullName: r.full_name, minutes: Number(r.minutes) })),
  }
}

/**
 * Total logged minutes per task (all users, via the SECURITY DEFINER batch RPC),
 * keyed by task_id. For board rollups where one query beats N single-task calls.
 * Tasks with no logged time are absent from the map.
 */
export async function getTasksTimeTotals(taskIds: string[], client?: SupabaseClient): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {}
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.rpc('tasks_time_summary', { p_task_ids: taskIds })
  if (error) {
    throw new Error(error.message || 'Failed to load task time totals')
  }
  const rows = (data ?? []) as Array<{ task_id: string; minutes: number }>
  const out: Record<string, number> = {}
  for (const r of rows) out[r.task_id] = Number(r.minutes)
  return out
}

export interface TaskTimeEntryRow {
  id: string
  entry_date: string
  duration_minutes: number
  description: string | null
  billable: boolean
  person: { full_name: string } | null
}

/**
 * Itemised time entries for a task, RLS-scoped (the viewer's own entries only),
 * newest first, joined to the attributed person's name. Pairs with the
 * aggregate getTaskTimeSummary for the headline numbers.
 */
export async function listTaskTimeEntries(taskId: string, client?: SupabaseClient): Promise<TaskTimeEntryRow[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('time_entries')
    .select('id, entry_date, duration_minutes, description, billable, person:people(full_name)')
    .eq('task_id', taskId)
    .eq('is_running', false)
    .gt('duration_minutes', 0)
    .order('entry_date', { ascending: false })
  if (error) {
    throw new Error(error.message || 'Failed to load task time entries')
  }
  return (data ?? []) as unknown as TaskTimeEntryRow[]
}

interface WeeklyTotals {
  date: string
  minutes: number
  amount: number
  billable_minutes: number
}

export async function getWeeklyTotals(
  fromDate: string,
  toDate: string,
  filters?: { account_id?: string; project_id?: string; billable?: boolean },
  client?: SupabaseClient
): Promise<WeeklyTotals[]> {
  const entries = await listTimeEntries(
    {
      account_id: filters?.account_id,
      project_id: filters?.project_id,
      date_from: fromDate,
      date_to: toDate,
      billable: filters?.billable,
      limit: 1000,
    },
    client
  )

  const byDate = new Map<string, WeeklyTotals>()

  for (const entry of entries) {
    const existing = byDate.get(entry.entry_date) ?? {
      date: entry.entry_date,
      minutes: 0,
      amount: 0,
      billable_minutes: 0,
    }

    existing.minutes += entry.duration_minutes
    if (entry.billable) {
      existing.billable_minutes += entry.duration_minutes
      existing.amount += (entry.duration_minutes / 60) * entry.rate_snapshot
    }

    byDate.set(entry.entry_date, existing)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Unbilled billable time for an account, grouped by project, for the invoice
 * form's "pull hours onto invoice" widget. Only stopped, billable, not-yet-billed
 * entries count (end_at is not null). Each group carries the entry ids so the
 * invoice-save step can mark exactly those entries billed. Amount and the blended
 * hourly rate are rounded to 2dp so the invoice line, PDF, and Stripe pence agree.
 */
export async function getInvoiceableSummary(
  scope: { account_id?: string; engagement_id?: string },
  client?: SupabaseClient
): Promise<UnbilledTimeGroup[]> {
  if (!scope.account_id && !scope.engagement_id) return []
  const supabase = await getSupabase(client)
  let query = supabase
    .from('time_entries')
    .select('id, project_id, engagement_id, duration_minutes, rate_snapshot, project:projects(id, name), engagement:engagements(id, code, name)')
    .eq('is_running', false)
    .eq('billable', true)
    .eq('billed', false)
    .not('end_at', 'is', null)
    .gt('duration_minutes', 0)
  if (scope.account_id) query = query.eq('account_id', scope.account_id)
  if (scope.engagement_id) query = query.eq('engagement_id', scope.engagement_id)
  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load unbilled time')
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string
    project_id: string | null
    engagement_id: string | null
    duration_minutes: number
    rate_snapshot: number
    project: { id: string; name: string } | null
    engagement: { id: string; code: string | null; name: string } | null
  }>

  // Group by engagement, then project, so the invoice widget can show
  // "QOLA-UKEU-26 › Qola - UK/EU › 6.5h @ £175".
  const groups = new Map<
    string,
    {
      project_id: string | null
      project_name: string
      engagement_id: string | null
      engagement_code: string | null
      engagement_name: string | null
      minutes: number
      amount: number
      entry_ids: string[]
    }
  >()

  for (const row of rows) {
    const key = `${row.engagement_id ?? 'none'}|${row.project_id ?? 'general'}`
    const existing =
      groups.get(key) ?? {
        project_id: row.project_id,
        project_name: row.project?.name ?? 'General time',
        engagement_id: row.engagement_id,
        engagement_code: row.engagement?.code ?? null,
        engagement_name: row.engagement?.name ?? null,
        minutes: 0,
        amount: 0,
        entry_ids: [],
      }

    existing.minutes += row.duration_minutes
    existing.amount += (row.duration_minutes / 60) * Number(row.rate_snapshot)
    existing.entry_ids.push(row.id)
    groups.set(key, existing)
  }

  return Array.from(groups.values())
    .sort((a, b) => (a.engagement_code ?? '').localeCompare(b.engagement_code ?? '') || a.project_name.localeCompare(b.project_name))
    .map((g) => ({
      ...g,
      amount: Math.round(g.amount * 100) / 100,
      rate: g.minutes > 0 ? Math.round((g.amount / (g.minutes / 60)) * 100) / 100 : 0,
    }))
}

/** Mark specific time entries billed and link them to the invoice. */
export async function markTimeEntriesAsBilled(
  entryIds: string[],
  invoiceId: string,
  client?: SupabaseClient
): Promise<void> {
  if (entryIds.length === 0) return
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('time_entries')
    .update({ billed: true, invoice_id: invoiceId })
    .in('id', entryIds)

  if (error) {
    throw new Error(error.message || 'Failed to mark time entries as billed')
  }
}

/** Release every time entry linked to an invoice back to unbilled (used when an
 *  invoice is deleted/soft-deleted so the hours reappear on the widget). */
export async function unmarkTimeEntriesForInvoice(
  invoiceId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('time_entries')
    .update({ billed: false, invoice_id: null })
    .eq('invoice_id', invoiceId)

  if (error) {
    throw new Error(error.message || 'Failed to release billed time entries')
  }
}
