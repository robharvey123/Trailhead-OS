import { createClient } from '@/lib/supabase/server'
import type { EngagementTaskPriority, QuoteStatus, TaskPriority } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type RelationValue<T> = T | T[] | null

// The daily brief reads engagement_tasks, the canonical task table behind /tasks
// and /my-work/[id]. It used to read the legacy `tasks` table, which stopped being
// written in October 2026, so the brief showed stale tasks whose links 404'd.
type DailyBriefTaskRow = {
  id: string
  title: string
  priority: EngagementTaskPriority
  due_date: string | null
  engagement_id: string | null
  engagement: RelationValue<{
    id: string
    name: string
  }>
}

type DailyBriefQuoteRow = {
  id: string
  status: QuoteStatus
  title: string
  summary: string | null
  created_at: string
  created_by_id: string | null
  accounts: RelationValue<{
    name: string
  }>
}

type DailyBriefEventRow = {
  id: string
  title: string
  start_at: string
  all_day: boolean
  user_id: string | null
  location: string | null
}

export interface DailyBriefTask {
  id: string
  title: string
  priority: TaskPriority
  due_date: string | null
  workstream_id: string | null
  workstream_slug: string | null
  workstream_label: string | null
  workstream_colour: string | null
}

export interface DailyBriefQuote {
  id: string
  status: Extract<QuoteStatus, 'draft' | 'review'>
  title: string
  summary: string | null
  created_at: string
  account_name: string | null
}

export interface DailyBriefCalendarEvent {
  id: string
  title: string
  start_at: string
  all_day: boolean
  location: string | null
}

export interface DailyBriefDay {
  date: string
  tasks: DailyBriefTask[]
  events: DailyBriefCalendarEvent[]
}

export interface DailyBriefData {
  actionRequired: DailyBriefTask[]
  quotesAttention: DailyBriefQuote[]
  todayTasks: DailyBriefTask[]
  weekAhead: DailyBriefDay[]
}

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function firstRelation<T>(value: RelationValue<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function toDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function getActionPriorityRank(priority: TaskPriority) {
  if (priority === 'critical' || priority === 'urgent') {
    return 0
  }

  if (priority === 'high') {
    return 1
  }

  if (priority === 'medium') {
    return 2
  }

  return 3
}

function isUrgentTier(priority: TaskPriority) {
  return priority === 'critical' || priority === 'urgent'
}

function mapTask(row: DailyBriefTaskRow): DailyBriefTask {
  const engagement = firstRelation(row.engagement)

  return {
    id: row.id,
    title: row.title,
    // engagement_tasks uses 'normal' where the brief's ranking expects 'medium'.
    priority: row.priority === 'normal' ? 'medium' : row.priority,
    due_date: row.due_date,
    // The brief's card shape predates engagements; the engagement fills the
    // grouping slot the workstream used to.
    workstream_id: row.engagement_id,
    workstream_slug: null,
    workstream_label: engagement?.name ?? null,
    workstream_colour: null,
  }
}

function mapQuote(row: DailyBriefQuoteRow): DailyBriefQuote {
  const account = firstRelation(row.accounts)

  return {
    id: row.id,
    status: row.status === 'review' ? 'review' : 'draft',
    title: row.title,
    summary: row.summary,
    created_at: row.created_at,
    account_name: account?.name ?? null,
  }
}

function mapEvent(row: DailyBriefEventRow): DailyBriefCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    start_at: row.start_at,
    all_day: row.all_day,
    location: row.location,
  }
}

function isActionRequiredTask(task: DailyBriefTask, todayKey: string) {
  if (!task.due_date) {
    return false
  }

  if (task.due_date > todayKey) {
    return false
  }

  return isUrgentTier(task.priority) || task.priority === 'high'
}

function compareActionRequired(left: DailyBriefTask, right: DailyBriefTask, todayKey: string) {
  const leftOverdue = left.due_date !== todayKey
  const rightOverdue = right.due_date !== todayKey

  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1
  }

  const priorityRank = getActionPriorityRank(left.priority) - getActionPriorityRank(right.priority)
  if (priorityRank !== 0) {
    return priorityRank
  }

  const dueDateRank = (left.due_date ?? '').localeCompare(right.due_date ?? '')
  if (dueDateRank !== 0) {
    return dueDateRank
  }

  return left.title.localeCompare(right.title)
}

function compareRemainingToday(left: DailyBriefTask, right: DailyBriefTask) {
  const priorityRank = getActionPriorityRank(left.priority) - getActionPriorityRank(right.priority)
  if (priorityRank !== 0) {
    return priorityRank
  }

  return left.title.localeCompare(right.title)
}

function compareTimelineTask(left: DailyBriefTask, right: DailyBriefTask) {
  const priorityRank = getActionPriorityRank(left.priority) - getActionPriorityRank(right.priority)
  if (priorityRank !== 0) {
    return priorityRank
  }

  return left.title.localeCompare(right.title)
}

function toEventDateKey(value: string) {
  return toDateKey(new Date(value))
}

export async function getDailyBriefData(
  userId: string,
  personId: string | null,
  today: Date,
  client?: SupabaseClient
): Promise<DailyBriefData> {
  const supabase = await getSupabase(client)
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  const todayKey = toDateKey(todayStart)
  const weekEnd = addDays(todayStart, 7)
  const weekEndKey = toDateKey(weekEnd)
  const weekEndExclusive = addDays(todayStart, 8)
  const weekEndExclusiveIso = weekEndExclusive.toISOString()

  const [tasksResult, quotesResult, eventsResult] = await Promise.all([
    personId
      ? supabase
          .from('engagement_tasks')
          .select('id, title, priority, due_date, engagement_id, engagement:engagements(id, name)')
          // Mine, plus unassigned: most engagement tasks carry no assignee, and
          // in a one-operator business an unassigned task is the owner's.
          .or(`assignee_person_id.eq.${personId},assignee_person_id.is.null`)
          .not('due_date', 'is', null)
          .lte('due_date', weekEndKey)
          .is('completed_at', null)
          .neq('status', 'done')
          .order('due_date', { ascending: true })
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as DailyBriefTaskRow[], error: null }),
    supabase
      .from('quotes')
      .select('id, status, title, summary, created_at, created_by_id, accounts(name)')
      .is('deleted_at', null)
      .in('status', ['draft', 'review'])
      .eq('created_by_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, all_day, user_id, location')
      .eq('user_id', userId)
      .gte('start_at', todayStart.toISOString())
      .lt('start_at', weekEndExclusiveIso)
      .order('start_at', { ascending: true }),
  ])

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message || 'Failed to load daily brief tasks')
  }

  if (quotesResult.error) {
    throw new Error(quotesResult.error.message || 'Failed to load daily brief quotes')
  }

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message || 'Failed to load daily brief events')
  }

  const tasks = ((tasksResult.data ?? []) as DailyBriefTaskRow[]).map(mapTask)
  const quotesAttention = ((quotesResult.data ?? []) as DailyBriefQuoteRow[]).map(mapQuote)
  const events = ((eventsResult.data ?? []) as DailyBriefEventRow[]).map(mapEvent)

  const actionRequired = tasks
    .filter((task) => isActionRequiredTask(task, todayKey))
    .sort((left, right) => compareActionRequired(left, right, todayKey))

  const actionRequiredIds = new Set(actionRequired.map((task) => task.id))

  const todayTasks = tasks
    .filter((task) => task.due_date === todayKey && !actionRequiredIds.has(task.id))
    .sort(compareRemainingToday)

  const weekAheadTasks = tasks.filter(
    (task) => Boolean(task.due_date) && task.due_date! >= todayKey && task.due_date! <= weekEndKey
  )

  const weekAhead: DailyBriefDay[] = Array.from({ length: 8 }, (_, index) => {
    const date = toDateKey(addDays(todayStart, index))

    return {
      date,
      tasks: weekAheadTasks
        .filter((task) => task.due_date === date)
        .sort(compareTimelineTask),
      events: events.filter((event) => toEventDateKey(event.start_at) === date),
    }
  })

  return {
    actionRequired,
    quotesAttention,
    todayTasks,
    weekAhead,
  }
}