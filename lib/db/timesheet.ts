import { createClient } from '@/lib/supabase/server'
import type { TimeEntry } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

/** If an engagement is set but no workstream, default to its first workstream (or 'Unspecified'). */
async function resolveWorkstream(
  supabase: SupabaseClient,
  engagementId: string | null | undefined,
  workstream: string | null | undefined
): Promise<string | null> {
  if (workstream) return workstream
  if (!engagementId) return null
  const { data } = await supabase.from('engagements').select('workstreams').eq('id', engagementId).maybeSingle()
  const list = (data?.workstreams as string[] | undefined) ?? []
  return list[0] ?? 'Unspecified'
}

interface TimeEntryFilters {
  account_id?: string
  project_id?: string
  date_from?: string
  date_to?: string
  billable?: boolean
  limit?: number
  offset?: number
}

export async function listTimeEntries(
  filters: TimeEntryFilters = {},
  client?: SupabaseClient
): Promise<TimeEntry[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('time_entries')
    .select('*')
    .eq('is_running', false)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }

  if (filters.date_from) {
    query = query.gte('entry_date', filters.date_from)
  }

  if (filters.date_to) {
    query = query.lte('entry_date', filters.date_to)
  }

  if (typeof filters.billable === 'boolean') {
    query = query.eq('billable', filters.billable)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load time entries')
  }

  return (data ?? []) as TimeEntry[]
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
    workstream?: string | null
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
  const rate = data.rate_snapshot ?? 0
  const workstream = await resolveWorkstream(supabase, data.engagement_id, data.workstream)

  const payload = {
    user_id: userId,
    account_id: data.account_id ?? null,
    project_id: data.project_id ?? null,
    engagement_id: data.engagement_id ?? null,
    workstream,
    entry_date: entryDate,
    start_at: null,
    end_at: null,
    duration_minutes: Math.round(data.duration_minutes),
    description: data.description?.trim() || null,
    billable: data.billable ?? true,
    rate_snapshot: rate,
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

export async function updateTimeEntry(
  id: string,
  data: Partial<TimeEntry>,
  client?: SupabaseClient
): Promise<TimeEntry> {
  const supabase = await getSupabase(client)

  const patch: Record<string, unknown> = {}

  if ('duration_minutes' in data && data.duration_minutes !== undefined) {
    patch.duration_minutes = Math.round(data.duration_minutes)
  }

  if ('description' in data) {
    patch.description = data.description?.trim() || null
  }

  if ('billable' in data && data.billable !== undefined) {
    patch.billable = data.billable
  }

  if ('account_id' in data) {
    patch.account_id = data.account_id ?? null
  }

  if ('project_id' in data) {
    patch.project_id = data.project_id ?? null
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
    workstream?: string | null
    description?: string | null
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
  const workstream = await resolveWorkstream(supabase, data.engagement_id, data.workstream)

  const payload = {
    user_id: userId,
    account_id: data.account_id ?? null,
    project_id: data.project_id ?? null,
    engagement_id: data.engagement_id ?? null,
    workstream,
    entry_date: entryDate,
    start_at: startAt,
    end_at: null,
    duration_minutes: 0,
    description: data.description?.trim() || null,
    billable: true,
    rate_snapshot: 0, // Will be stamped on stop
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

export async function stopTimer(
  id: string,
  rateSnapshot?: number,
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
  const durationMinutes = Math.round(durationMs / 60000)

  // If a rate snapshot is provided (e.g. from project/account), use it; else keep 0
  const rate = rateSnapshot ?? (entry.rate_snapshot || 0)

  const { data: stopped, error: updateError } = await supabase
    .from('time_entries')
    .update({
      end_at: endAt,
      duration_minutes: durationMinutes,
      rate_snapshot: rate,
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
): Promise<TimeEntry | null> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()

  if (!auth.data.user) {
    return null
  }

  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('user_id', auth.data.user.id)
    .eq('is_running', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to fetch running timer')
  }

  return (data as TimeEntry | null) ?? null
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

export async function getInvoiceableSummary(
  accountId: string,
  fromDate: string,
  toDate: string,
  client?: SupabaseClient
): Promise<
  Array<{
    project_id: string | null
    project_name?: string
    billable_minutes: number
    billable_amount: number
  }>
> {
  const entries = await listTimeEntries(
    {
      account_id: accountId,
      date_from: fromDate,
      date_to: toDate,
      billable: true,
      limit: 1000,
    },
    client
  )

  const byProject = new Map<string | null, { minutes: number; amount: number; name?: string }>()

  for (const entry of entries) {
    const projectId = entry.project_id ?? 'no-project'
    const existing = byProject.get(projectId) ?? {
      minutes: 0,
      amount: 0,
    }

    existing.minutes += entry.duration_minutes
    existing.amount += (entry.duration_minutes / 60) * entry.rate_snapshot

    byProject.set(projectId, existing)
  }

  return Array.from(byProject.entries()).map(([projectId, totals]) => ({
    project_id: projectId === 'no-project' ? null : projectId,
    billable_minutes: totals.minutes,
    billable_amount: totals.amount,
  }))
}
