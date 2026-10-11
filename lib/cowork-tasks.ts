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
  isUuid,
  optionalIsoDatetime,
  optionalNumber,
  optionalString,
  parseTags,
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
  'workstream',
  'project_id',
  'phase_id',
  'account_id',
  'contact_id',
  'due_time',
  'estimated_hours',
  'actual_hours',
  'tags',
]

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new CoworkApiError(`${field} must be a uuid or null`, 400)
  }
  return value
}

function optionalTime(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) {
    throw new CoworkApiError(`${field} must be HH:MM`, 400)
  }
  return value
}

function optionalHours(value: unknown, field: string) {
  const hours = optionalNumber(value, field)
  if (hours !== null && !Number.isInteger(hours)) {
    throw new CoworkApiError(`${field} must be a whole number of hours`, 400)
  }
  return hours
}

async function assertExists(table: string, id: string, field: string) {
  const { data, error } = await supabaseService.from(table).select('id').eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || `Failed to check ${field}`, 500)
  if (!data) throw new CoworkApiError(`${field} not found: ${id}`, 400)
}

/**
 * A phase belongs to one project, so a task's phase and project must agree.
 * Returns the phase's project id; callers use it to fill project_id when only
 * phase_id was supplied.
 */
async function phaseProjectId(phaseId: string) {
  const { data, error } = await supabaseService
    .from('project_phases')
    .select('project_id')
    .eq('id', phaseId)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load phase', 500)
  if (!data) throw new CoworkApiError(`phase_id not found: ${phaseId}`, 400)
  return data.project_id as string
}

/**
 * Resolves project_id / phase_id together so the pair always agrees: a phase
 * implies its project, both sent must match (409 otherwise), and moving a
 * task to another project drops a phase that belonged to the old one.
 */
async function resolveProjectAndPhase(
  body: Record<string, unknown>,
  current: { project_id: string | null; phase_id: string | null }
) {
  const patch: Record<string, unknown> = {}
  const projectSent = body.project_id !== undefined
  const phaseSent = body.phase_id !== undefined
  const projectId = projectSent ? nullableUuid(body.project_id, 'project_id') : null
  const phaseId = phaseSent ? nullableUuid(body.phase_id, 'phase_id') : null

  if (projectSent) {
    if (projectId) await assertExists('projects', projectId, 'project_id')
    patch.project_id = projectId
  }

  if (phaseSent) {
    patch.phase_id = phaseId
    if (phaseId) {
      const owner = await phaseProjectId(phaseId)
      if (projectSent && projectId !== owner) {
        throw new CoworkApiError('phase_id belongs to a different project than project_id', 409)
      }
      patch.project_id = owner
    }
  } else if (projectSent && current.phase_id) {
    const owner = await phaseProjectId(current.phase_id).catch(() => null)
    if (owner !== projectId) patch.phase_id = null
  }

  return patch
}

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
  const columnValue = body.column !== undefined ? body.column : body.status
  const columnId =
    columnValue !== undefined && columnValue !== null
      ? await getColumnIdForWorkstream(workstream.id, parseColumnKey(columnValue))
      : backlogColumnId
  const links = await resolveProjectAndPhase(body, { project_id: null, phase_id: null })

  const { data, error } = await supabaseService
    .from('tasks')
    .insert({
      title,
      workstream_id: workstream.id,
      project_id: (links.project_id as string | null | undefined) ?? null,
      phase_id: (links.phase_id as string | null | undefined) ?? null,
      column_id: columnId,
      priority,
      due_date: dueDate,
      start_date: startDate,
      due_time: optionalTime(body.due_time, 'due_time'),
      estimated_hours: optionalHours(body.estimated_hours, 'estimated_hours'),
      tags: parseTags(body.tags) ?? [],
      description,
      is_master_todo: isMasterTodo,
      completed_at: columnValue === 'done' ? new Date().toISOString() : null,
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

  if (body.due_time !== undefined) patch.due_time = optionalTime(body.due_time, 'due_time')
  if (body.estimated_hours !== undefined) {
    patch.estimated_hours = optionalHours(body.estimated_hours, 'estimated_hours')
  }
  if (body.actual_hours !== undefined) {
    patch.actual_hours = optionalHours(body.actual_hours, 'actual_hours')
  }
  if (body.tags !== undefined) patch.tags = parseTags(body.tags) ?? []

  if (body.account_id !== undefined) {
    const accountId = nullableUuid(body.account_id, 'account_id')
    if (accountId) await assertExists('accounts', accountId, 'account_id')
    patch.account_id = accountId
  }

  if (body.contact_id !== undefined) {
    const contactId = nullableUuid(body.contact_id, 'contact_id')
    if (contactId) await assertExists('contacts', contactId, 'contact_id')
    patch.contact_id = contactId
  }

  if (body.project_id !== undefined || body.phase_id !== undefined) {
    Object.assign(
      patch,
      await resolveProjectAndPhase(body, {
        project_id: existingTask.project_id,
        phase_id: existingTask.phase_id ?? null,
      })
    )
  }

  // `status` is an alias for `column` — the obvious field name cost twenty
  // minutes of live probing (23 Aug). Same enum, `column` wins if both sent.
  // Moving workstream re-homes the card on the new board: the named column if
  // one was sent, otherwise Backlog, since column ids are per-workstream.
  const columnValue = body.column !== undefined ? body.column : body.status
  let targetWorkstreamId = existingTask.workstream_id
  if (body.workstream !== undefined) {
    const workstream = await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))
    targetWorkstreamId = workstream.id
    patch.workstream_id = workstream.id
  }

  if (columnValue !== undefined || body.workstream !== undefined) {
    if (!targetWorkstreamId) {
      throw new CoworkApiError('Task has no workstream to move within', 400)
    }

    patch.column_id = await getColumnIdForWorkstream(
      targetWorkstreamId,
      columnValue !== undefined ? parseColumnKey(columnValue) : 'backlog'
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
