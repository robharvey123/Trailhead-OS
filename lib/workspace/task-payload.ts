import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type ChecklistItem = {
  id: string
  title: string
  done: boolean
}

type RecurrencePayload = {
  cadence: 'weekly' | 'monthly' | null
  interval: number
  endDate: string | null
}

export type WorkspaceTaskSeed = {
  scheduled_date: string
  title: string
  description: string | null
  category: string | null
  planned_start_time: string | null
  task_color: string | null
  duration_minutes: number
  required_people: number
  priority: string
  status: string
  sort_order: number
  checklist_items: ChecklistItem[]
  recurrence_cadence: 'weekly' | 'monthly' | null
  recurrence_interval: number
  recurrence_end_date: string | null
}

export function parseDate(value?: string | null) {
  if (!value) return null
  const dt = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10)
}

export function parseTime(value?: string | null) {
  if (!value) return null
  const normalized = String(value).trim()
  const match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/)
  if (!match) return null
  const hours = match[1]
  const minutes = match[2]
  const seconds = match[3] || '00'
  return `${hours}:${minutes}:${seconds}`
}

export function parseHexColor(value?: string | null) {
  if (!value) return null
  const normalized = String(value).trim()
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return null
  return `#${match[1].toLowerCase()}`
}

export function parseChecklistItems(value: unknown): ChecklistItem[] | null {
  if (value === undefined || value === null || value === '') return []
  if (!Array.isArray(value)) return null

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const raw = item as Record<string, unknown>
      const title = String(raw.title || '').trim()
      if (!title) return null
      const id = String(raw.id || '').trim() || `item-${index + 1}`
      return { id, title, done: Boolean(raw.done) }
    })
    .filter(Boolean) as ChecklistItem[]
}

export function parseRecurrencePayload(value: Record<string, unknown>): RecurrencePayload | { error: string } {
  const rawCadence = value.recurrence_cadence
  if (rawCadence === undefined || rawCadence === null || rawCadence === '') {
    return { cadence: null, interval: 1, endDate: null }
  }

  const cadence = String(rawCadence).toLowerCase()
  if (cadence !== 'weekly' && cadence !== 'monthly') {
    return { error: 'recurrence_cadence must be weekly or monthly' }
  }

  const interval = Number(value.recurrence_interval || 1)
  if (!Number.isFinite(interval) || interval <= 0 || interval > 52) {
    return { error: 'recurrence_interval must be between 1 and 52' }
  }

  const endDate = parseDate((value.recurrence_end_date as string | null | undefined) || null)
  if (!endDate) {
    return { error: 'recurrence_end_date must be supplied when recurrence is enabled' }
  }

  return { cadence, interval: Math.round(interval), endDate }
}

export function nextRecurringDate(dateString: string, cadence: 'weekly' | 'monthly', interval: number) {
  const dt = new Date(`${dateString}T00:00:00.000Z`)
  if (cadence === 'weekly') {
    dt.setUTCDate(dt.getUTCDate() + interval * 7)
  } else {
    dt.setUTCMonth(dt.getUTCMonth() + interval)
  }
  return dt.toISOString().slice(0, 10)
}

export async function createRecurringTaskCopies(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  seedTask: WorkspaceTaskSeed
  parentTaskId: string
}) {
  const { supabase, workspaceId, userId, seedTask, parentTaskId } = args
  if (!seedTask.recurrence_cadence || !seedTask.recurrence_end_date) return
  if (!seedTask.scheduled_date) return

  const targetDates: string[] = []
  let nextDate = nextRecurringDate(
    seedTask.scheduled_date,
    seedTask.recurrence_cadence,
    seedTask.recurrence_interval || 1
  )

  while (nextDate <= seedTask.recurrence_end_date) {
    targetDates.push(nextDate)
    nextDate = nextRecurringDate(nextDate, seedTask.recurrence_cadence, seedTask.recurrence_interval || 1)
  }

  if (targetDates.length === 0) return

  const existingRes = await supabase
    .from('workspace_tasks')
    .select('scheduled_date')
    .eq('workspace_id', workspaceId)
    .eq('recurrence_parent_task_id', parentTaskId)
    .in('scheduled_date', targetDates)

  const existingDates = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (existingRes.data || []).map((row: any) => String(row.scheduled_date))
  )
  const rows: Array<Record<string, unknown>> = []

  for (const scheduledDate of targetDates) {
    if (existingDates.has(scheduledDate)) continue
    rows.push({
      workspace_id: workspaceId,
      scheduled_date: scheduledDate,
      title: seedTask.title,
      description: seedTask.description,
      category: seedTask.category,
      planned_start_time: seedTask.planned_start_time,
      task_color: seedTask.task_color,
      duration_minutes: seedTask.duration_minutes,
      required_people: seedTask.required_people,
      priority: seedTask.priority,
      status: 'open',
      sort_order: seedTask.sort_order,
      created_by: userId,
      checklist_items: seedTask.checklist_items,
      recurrence_cadence: seedTask.recurrence_cadence,
      recurrence_interval: seedTask.recurrence_interval,
      recurrence_end_date: seedTask.recurrence_end_date,
      recurrence_parent_task_id: parentTaskId,
    })
  }

  if (rows.length > 0) {
    await supabase.from('workspace_tasks').insert(rows)
  }
}
