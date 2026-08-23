import {
  TASK_SELECT,
  addDays,
  CoworkApiError,
  noRecognisedFieldsError,
  formatTask,
  getColumnIdForWorkstream,
  getTaskById,
  getWorkstreamBySlug,
  optionalDate,
  optionalIsoDatetime,
  optionalString,
  parseColumnKey,
  parsePriority,
  requiredString,
  sendCoworkTaskNotification,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'
import type { TaskPriority } from '@/lib/types'

/**
 * Shared task logic for the Cowork REST API *and* the MCP server. Both the
 * `/api/cowork/tasks` routes and the MCP `list_tasks` / `create_task` /
 * `update_task` / `complete_task` tools call these so there is a single source
 * of truth for validation and the response shape (`formatTask`).
 *
 * Helpers throw `CoworkApiError` on bad input; the REST routes map that to the
 * right status via `jsonError`, and the MCP server wraps thrown errors into tool
 * error responses.
 */

export type CoworkTaskDueFilter = 'today' | 'overdue' | 'this_week' | 'all'

/** Accepted-field list quoted back on a no-recognised-fields 400. */
export const TASK_PATCH_FIELDS = [
  'title',
  'description',
  'priority',
  'due_date',
  'start_date',
  'is_master_todo',
  'completed_at',
  'column',
  'status',
]

export interface ListCoworkTasksFilters {
  workstreamSlug?: string | null
  projectId?: string | null
  priority?: TaskPriority | null
  due?: CoworkTaskDueFilter
  master?: boolean
  limit?: number
}

/** GET /api/cowork/tasks — list OS kanban tasks with optional filters. */
export async function listCoworkTasks(filters: ListCoworkTasksFilters = {}) {
  const { workstreamSlug = null, projectId = null, priority = null } = filters
  const due = filters.due ?? 'all'
  const limit = filters.limit ?? 50
  const today = todayDate()
  const weekEnd = addDays(today, 7)
  const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

  let query = supabaseService
    .from('tasks')
    .select(TASK_SELECT)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (workstream) {
    query = query.eq('workstream_id', workstream.id)
  }

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  if (filters.master === true) {
    query = query.eq('is_master_todo', true)
  }

  if (due === 'today') {
    query = query.eq('due_date', today).is('completed_at', null)
  }

  if (due === 'overdue') {
    query = query.lt('due_date', today).is('completed_at', null)
  }

  if (due === 'this_week') {
    query = query.gte('due_date', today).lte('due_date', weekEnd).is('completed_at', null)
  }

  const { data, error } = await query

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load tasks', 500)
  }

  return (data ?? []).map((row) => formatTask(row as never))
}

/**
 * POST /api/cowork/tasks — create a single OS task in the workstream's Backlog.
 * Accepts the raw request body (REST) or a validated object (MCP); validation is
 * enforced here either way.
 */
export async function createCoworkTask(body: Record<string, unknown>) {
  const title = requiredString(body.title, 'title')
  const workstream = await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))
  const backlogColumnId = await getColumnIdForWorkstream(workstream.id, 'backlog')
  const priority = parsePriority(body.priority)
  const dueDate = optionalDate(body.due_date, 'due_date')
  const startDate = optionalDate(body.start_date, 'start_date')
  const description = optionalString(body.description)
  const isMasterTodo = body.is_master_todo === true

  const { data, error } = await supabaseService
    .from('tasks')
    .insert({
      title,
      workstream_id: workstream.id,
      project_id: optionalString(body.project_id),
      column_id: backlogColumnId,
      priority,
      due_date: dueDate,
      start_date: startDate,
      description,
      is_master_todo: isMasterTodo,
      contact_id: optionalString(body.contact_id),
      account_id: optionalString(body.account_id),
    })
    .select(TASK_SELECT)
    .single()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to create task', 500)
  }

  void sendCoworkTaskNotification({
    id: String(data.id),
    title: String(data.title),
  }).catch(() => {})

  return formatTask(data as never)
}

/**
 * PATCH /api/cowork/tasks/:id — patch an OS task. Accepts the raw request body
 * (REST) or a validated object (MCP). Only supplied keys are changed.
 */
export async function updateCoworkTask(id: string, body: Record<string, unknown>) {
  const existingTask = await getTaskById(id)
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = optionalString(body.title)
    if (!title) {
      throw new CoworkApiError('title must be a non-empty string', 400)
    }
    patch.title = title
  }

  if (body.description !== undefined) {
    patch.description = optionalString(body.description)
  }

  if (body.priority !== undefined) {
    patch.priority = parsePriority(body.priority)
  }

  if (body.due_date !== undefined) {
    patch.due_date = optionalDate(body.due_date, 'due_date')
  }

  if (body.start_date !== undefined) {
    patch.start_date = optionalDate(body.start_date, 'start_date')
  }

  if (body.is_master_todo !== undefined) {
    if (typeof body.is_master_todo !== 'boolean') {
      throw new CoworkApiError('is_master_todo must be a boolean', 400)
    }
    patch.is_master_todo = body.is_master_todo
  }

  if (body.completed_at !== undefined) {
    patch.completed_at = optionalIsoDatetime(body.completed_at, 'completed_at')
  }

  // `status` is an alias for `column` — the obvious field name cost twenty
  // minutes of live probing (23 Aug). Same enum, `column` wins if both sent.
  const columnValue = body.column !== undefined ? body.column : body.status
  if (columnValue !== undefined) {
    if (!existingTask.workstream_id) {
      throw new CoworkApiError('Task has no workstream to move within', 400)
    }

    patch.column_id = await getColumnIdForWorkstream(
      existingTask.workstream_id,
      parseColumnKey(columnValue)
    )
  }

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, TASK_PATCH_FIELDS)
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_SELECT)
    .single()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to update task', 500)
  }

  return formatTask(data as never)
}

/**
 * Convenience used by the MCP `complete_task` tool: mark a task done and stamp
 * `completed_at` now. Moves it into the Done column too (when it has a
 * workstream), matching how the board treats completed cards.
 */
export async function completeCoworkTask(id: string) {
  const existingTask = await getTaskById(id)
  const body: Record<string, unknown> = {
    completed_at: new Date().toISOString(),
  }
  if (existingTask.workstream_id) {
    body.column = 'done'
  }
  return updateCoworkTask(id, body)
}
