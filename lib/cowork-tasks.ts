import {
  CoworkApiError,
  addDays,
  isUuid,
  noRecognisedFieldsError,
  optionalDate,
  optionalString,
  parseTags,
  requiredString,
  sendCoworkTaskNotification,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'
import type { EngagementTaskPriority, EngagementTaskStatus } from '@/lib/types'

/**
 * Shared task logic for the Cowork REST API (`/api/cowork/tasks`) and the MCP
 * `list_tasks` / `create_task` / `update_task` tools.
 *
 * Since Nov 2026 these read and write `engagement_tasks`, the table /tasks,
 * My Work, the dashboard and the weekly report all use. The legacy kanban
 * `tasks` table has been frozen since 15 Oct 2026, so anything written there
 * never showed up in the app.
 *
 * Back-compat with the old kanban contract:
 * - priority `medium` is accepted and stored as `normal`.
 * - `column` is an alias for `status`, and `in-progress` maps to `in_progress`.
 * - `tags` is an alias for `labels`.
 * - `workstream`, `phase_id`, `start_date`, `due_time`, `estimated_hours`,
 *   `actual_hours`, `account_id`, `contact_id` and `is_master_todo` have no
 *   column on engagement_tasks and are ignored.
 *
 * New tasks need a project_id or engagement_id so they land on a board; the
 * engagement is taken from the project when only project_id is given. They are
 * reported by, and by default assigned to, the owner's person record.
 */

const TASK_SELECT =
  'id, title, description, status, priority, due_date, labels, position, completed_at, created_at, updated_at, engagement_id, project_id, assignee_person_id, reporter_person_id, engagement:engagements(id, name), project:projects(id, name), assignee:people!assignee_person_id(id, full_name)'

export type CoworkTaskDueFilter = 'today' | 'overdue' | 'this_week' | 'all'

export const TASK_PATCH_FIELDS = [
  'title',
  'description',
  'status',
  'column',
  'priority',
  'due_date',
  'labels',
  'tags',
  'project_id',
  'engagement_id',
  'assignee_person_id',
  'completed_at',
]

const IGNORED_LEGACY_FIELDS = new Set([
  'workstream',
  'phase_id',
  'start_date',
  'due_time',
  'estimated_hours',
  'actual_hours',
  'account_id',
  'contact_id',
  'is_master_todo',
])

const STATUS_ALIASES: Record<string, EngagementTaskStatus> = {
  backlog: 'backlog',
  todo: 'backlog',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  review: 'review',
  done: 'done',
  cancelled: 'cancelled',
}

const PRIORITY_ALIASES: Record<string, EngagementTaskPriority> = {
  low: 'low',
  medium: 'normal',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
}

export function parseTaskStatus(value: unknown): EngagementTaskStatus {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const status = STATUS_ALIASES[key]
  if (!status) {
    throw new CoworkApiError('status must be backlog|in_progress|review|done|cancelled', 400)
  }
  return status
}

export function parseTaskPriority(value: unknown): EngagementTaskPriority {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const priority = PRIORITY_ALIASES[key]
  if (!priority) {
    throw new CoworkApiError('priority must be low|normal|high|urgent', 400)
  }
  return priority
}

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new CoworkApiError(`${field} must be a uuid or null`, 400)
  }
  return value
}

async function ownerPersonId(): Promise<string | null> {
  const { data } = await supabaseService
    .from('profiles')
    .select('person_id')
    .eq('role', 'owner')
    .not('person_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data?.person_id as string | undefined) ?? null
}

async function projectEngagementId(projectId: string): Promise<string | null> {
  const { data, error } = await supabaseService
    .from('projects')
    .select('id, engagement_id')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load project', 500)
  if (!data) throw new CoworkApiError(`project_id not found: ${projectId}`, 400)
  return (data.engagement_id as string | null) ?? null
}

async function assertExists(table: string, id: string, field: string) {
  const { data, error } = await supabaseService.from(table).select('id').eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || `Failed to check ${field}`, 500)
  if (!data) throw new CoworkApiError(`${field} not found: ${id}`, 400)
}

type TaskRow = {
  id: string
  title: string
  description: string | null
  status: EngagementTaskStatus
  priority: EngagementTaskPriority
  due_date: string | null
  labels: string[] | null
  position: number
  completed_at: string | null
  created_at: string
  updated_at: string
  engagement_id: string | null
  project_id: string | null
  assignee_person_id: string | null
  reporter_person_id: string | null
  engagement: { id: string; name: string } | { id: string; name: string }[] | null
  project: { id: string; name: string } | { id: string; name: string }[] | null
  assignee: { id: string; full_name: string } | { id: string; full_name: string }[] | null
}

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value)

export function formatCoworkTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    labels: row.labels ?? [],
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    engagement: one(row.engagement),
    project: one(row.project),
    assignee: one(row.assignee),
    url: `/my-work/${row.id}`,
  }
}

export type CoworkTask = ReturnType<typeof formatCoworkTask>

/** Load one engagement task, 404 if it does not exist. */
export async function getCoworkTask(id: string): Promise<CoworkTask> {
  if (!isUuid(id)) throw new CoworkApiError('Task not found', 404)
  const { data, error } = await supabaseService.from('engagement_tasks').select(TASK_SELECT).eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load task', 500)
  if (!data) throw new CoworkApiError('Task not found', 404)
  return formatCoworkTask(data as unknown as TaskRow)
}

export interface ListCoworkTasksFilters {
  projectId?: string | null
  engagementId?: string | null
  status?: EngagementTaskStatus | null
  priority?: EngagementTaskPriority | null
  due?: CoworkTaskDueFilter
  /** Include done and cancelled tasks. Off by default. */
  includeClosed?: boolean
  limit?: number
}

/** List engagement tasks, open ones by default, soonest due first. */
export async function listCoworkTasks(filters: ListCoworkTasksFilters = {}) {
  const due = filters.due ?? 'all'
  const limit = filters.limit ?? 50
  const today = todayDate()
  const weekEnd = addDays(today, 7)

  let query = supabaseService
    .from('engagement_tasks')
    .select(TASK_SELECT)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.engagementId) query = query.eq('engagement_id', filters.engagementId)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.status) {
    query = query.eq('status', filters.status)
  } else if (!filters.includeClosed) {
    query = query.not('status', 'in', '(done,cancelled)')
  }

  if (due === 'today') query = query.eq('due_date', today)
  if (due === 'overdue') query = query.lt('due_date', today)
  if (due === 'this_week') query = query.gte('due_date', today).lte('due_date', weekEnd)

  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load tasks', 500)
  return ((data ?? []) as unknown as TaskRow[]).map(formatCoworkTask)
}

/** Create one engagement task. Accepts a raw REST body or a validated MCP object. */
export async function createCoworkTask(body: Record<string, unknown>) {
  const title = requiredString(body.title, 'title')

  const projectId = body.project_id !== undefined ? nullableUuid(body.project_id, 'project_id') : null
  let engagementId = body.engagement_id !== undefined ? nullableUuid(body.engagement_id, 'engagement_id') : null
  if (projectId) {
    const fromProject = await projectEngagementId(projectId)
    if (engagementId && fromProject && engagementId !== fromProject) {
      throw new CoworkApiError('engagement_id does not match the project’s engagement', 409)
    }
    engagementId = engagementId ?? fromProject
  } else if (engagementId) {
    await assertExists('engagements', engagementId, 'engagement_id')
  }
  if (!projectId && !engagementId) {
    throw new CoworkApiError(
      'project_id or engagement_id is required so the task lands on a board. Use list_projects to find one.',
      400
    )
  }

  const owner = await ownerPersonId()
  const assignee =
    body.assignee_person_id !== undefined ? nullableUuid(body.assignee_person_id, 'assignee_person_id') : owner
  if (assignee && assignee !== owner) await assertExists('people', assignee, 'assignee_person_id')

  const statusValue = body.status !== undefined ? body.status : body.column
  const labels = parseTags(body.labels !== undefined ? body.labels : body.tags) ?? []

  // Append to the end of the project's board.
  let position = 0
  if (projectId) {
    const { data: last } = await supabaseService
      .from('engagement_tasks')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    position = Number(last?.position ?? 0) + 1
  }

  const { data, error } = await supabaseService
    .from('engagement_tasks')
    .insert({
      title,
      description: optionalString(body.description),
      status: statusValue !== undefined && statusValue !== null ? parseTaskStatus(statusValue) : 'backlog',
      priority: body.priority !== undefined && body.priority !== null ? parseTaskPriority(body.priority) : 'normal',
      due_date: optionalDate(body.due_date, 'due_date'),
      labels,
      project_id: projectId,
      engagement_id: engagementId,
      assignee_person_id: assignee,
      reporter_person_id: owner,
      position,
    })
    .select(TASK_SELECT)
    .single()

  if (error) throw new CoworkApiError(error.message || 'Failed to create task', 500)

  void sendCoworkTaskNotification({ id: String(data.id), title: String(data.title) }).catch(() => {})
  return formatCoworkTask(data as unknown as TaskRow)
}

/**
 * Patch one engagement task. Only supplied keys change. completed_at is
 * stamped by a DB trigger on the move to/from done; sending completed_at
 * (any non-null value) is treated as "mark done", null as "reopen".
 */
export async function updateCoworkTask(id: string, body: Record<string, unknown>) {
  const existing = await getCoworkTask(id)
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = optionalString(body.title)
    if (!title) throw new CoworkApiError('title must be a non-empty string', 400)
    patch.title = title
  }
  if (body.description !== undefined) patch.description = optionalString(body.description)
  if (body.priority !== undefined) patch.priority = parseTaskPriority(body.priority)
  if (body.due_date !== undefined) patch.due_date = optionalDate(body.due_date, 'due_date')

  const statusValue = body.status !== undefined ? body.status : body.column
  if (statusValue !== undefined) {
    patch.status = parseTaskStatus(statusValue)
  } else if (body.completed_at !== undefined) {
    if (body.completed_at === null) {
      if (existing.status === 'done') patch.status = 'backlog'
    } else {
      patch.status = 'done'
    }
  }

  const labelsValue = body.labels !== undefined ? body.labels : body.tags
  if (labelsValue !== undefined) patch.labels = parseTags(labelsValue) ?? []

  if (body.assignee_person_id !== undefined) {
    const assignee = nullableUuid(body.assignee_person_id, 'assignee_person_id')
    if (assignee) await assertExists('people', assignee, 'assignee_person_id')
    patch.assignee_person_id = assignee
  }

  if (body.project_id !== undefined) {
    const projectId = nullableUuid(body.project_id, 'project_id')
    patch.project_id = projectId
    if (projectId) {
      const fromProject = await projectEngagementId(projectId)
      if (fromProject) patch.engagement_id = fromProject
    }
  }
  if (body.engagement_id !== undefined && patch.engagement_id === undefined) {
    const engagementId = nullableUuid(body.engagement_id, 'engagement_id')
    if (engagementId) await assertExists('engagements', engagementId, 'engagement_id')
    patch.engagement_id = engagementId
  }

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      const onlyLegacy = Object.keys(body).every((key) => IGNORED_LEGACY_FIELDS.has(key))
      if (onlyLegacy) {
        throw new CoworkApiError(
          `${Object.keys(body).join(', ')} no longer exist on tasks. Accepted: ${TASK_PATCH_FIELDS.join(', ')}`,
          400
        )
      }
      throw noRecognisedFieldsError(body, TASK_PATCH_FIELDS)
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('engagement_tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update task', 500)
  return formatCoworkTask(data as unknown as TaskRow)
}

/** Mark a task done. completed_at is stamped by the DB trigger. */
export async function completeCoworkTask(id: string) {
  return updateCoworkTask(id, { status: 'done' })
}

/** Delete one engagement task. Returns the deleted task's title for the audit log. */
export async function deleteCoworkTask(id: string) {
  const existing = await getCoworkTask(id)
  const { error } = await supabaseService.from('engagement_tasks').delete().eq('id', id)
  if (error) throw new CoworkApiError(error.message || 'Failed to delete task', 500)
  return existing
}

/** Add a comment to an engagement task, authored by the owner. */
export async function addCoworkTaskComment(taskId: string, body: string) {
  await getCoworkTask(taskId)
  const text = body.trim()
  if (!text) throw new CoworkApiError('Comment body cannot be empty', 400)
  const { data, error } = await supabaseService
    .from('engagement_task_comments')
    .insert({ task_id: taskId, body: text, author_person_id: await ownerPersonId() })
    .select('id, task_id, body, created_at')
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to add comment', 500)
  return data
}
