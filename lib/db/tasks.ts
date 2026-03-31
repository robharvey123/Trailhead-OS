import { createClient } from '@/lib/supabase/server'
import type {
  BoardColumn,
  CreateTaskInput,
  ReorderTaskUpdate,
  Task,
  TaskFilters,
  TaskWithWorkstream,
  UpdateTaskInput,
  Workstream,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type TaskRowWithJoin = Task & {
  workstreams: Pick<Workstream, 'slug' | 'label' | 'colour'> | null
  projects: { name: string; title?: string | null } | null
  project_phases: { name: string } | null
}

function isMissingDueTimeColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return message.includes('due_time') && message.includes('does not exist')
}

function isMissingTaskProjectManagementColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''

  return (
    (message.includes('does not exist') || message.includes('could not find')) &&
    [
      'title',
      'status',
      'owner',
      'parent_task_id',
      'estimated_hours',
      'actual_hours',
      'order_index',
      'custom_fields',
    ].some((column) => message.includes(column))
  )
}

const TASK_SELECT_FULL =
  '*, workstreams(slug, label, colour), projects(name, title), project_phases(name)'

const TASK_SELECT_LEGACY =
  'id, workstream_id, column_id, account_id, contact_id, project_id, phase_id, title, description, priority, start_date, due_date, due_time, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour), projects(name), project_phases(name)'

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapTaskWithWorkstream(row: TaskRowWithJoin): TaskWithWorkstream {
  return {
    id: row.id,
    workstream_id: row.workstream_id,
    column_id: row.column_id,
    account_id: row.account_id,
    contact_id: row.contact_id,
    project_id: row.project_id,
    phase_id: row.phase_id ?? null,
    parent_task_id: row.parent_task_id ?? null,
    title: row.title,
    description: row.description,
    status: row.status ?? (row.completed_at ? 'done' : 'todo'),
    priority: row.priority,
    owner: row.owner ?? null,
    start_date: row.start_date ?? null,
    due_date: row.due_date,
    due_time: row.due_time ?? null,
    estimated_hours: row.estimated_hours ?? null,
    actual_hours: row.actual_hours ?? null,
    is_master_todo: row.is_master_todo,
    tags: row.tags ?? [],
    sort_order: row.sort_order,
    order_index: row.order_index ?? row.sort_order,
    custom_fields: row.custom_fields ?? {},
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    workstream_slug: row.workstreams?.slug ?? null,
    workstream_label: row.workstreams?.label ?? null,
    workstream_colour: row.workstreams?.colour ?? null,
    project_name: row.projects?.name ?? null,
    project_title: row.projects?.title ?? row.projects?.name ?? null,
    phase_name: row.project_phases?.name ?? null,
  }
}

async function resolveDefaultColumnId(
  workstreamId: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from('board_columns')
    .select('id')
    .eq('workstream_id', workstreamId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to resolve default column')
  }

  return (data as Pick<BoardColumn, 'id'> | null)?.id ?? null
}

async function runTasksQuery(
  supabase: SupabaseClient,
  filters: TaskFilters,
  options: { includeDueTimeOrder: boolean; legacySchema?: boolean }
) {
  let query = supabase
    .from('tasks')
    .select(options.legacySchema ? TASK_SELECT_LEGACY : TASK_SELECT_FULL)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!options.legacySchema) {
    query = query.order('order_index', { ascending: true })
  }

  if (options.includeDueTimeOrder) {
    query = query.order('due_time', { ascending: true, nullsFirst: false })
  }

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.workstream_ids?.length) {
    query = query.in('workstream_id', filters.workstream_ids)
  }

  if (filters.column_id) {
    query = query.eq('column_id', filters.column_id)
  }

  if (filters.contact_id) {
    query = query.eq('contact_id', filters.contact_id)
  }

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }

  if (typeof filters.is_master_todo === 'boolean') {
    query = query.eq('is_master_todo', filters.is_master_todo)
  }

  if (filters.due_date_from) {
    query = query.gte('due_date', filters.due_date_from)
  }

  if (filters.due_date_to) {
    query = query.lte('due_date', filters.due_date_to)
  }

  if (!filters.include_completed) {
    if (filters.completed) {
      query = query.not('completed_at', 'is', null)
    } else {
      query = query.is('completed_at', null)
    }
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  return query
}

export async function getTasks(
  filters: TaskFilters = {},
  client?: SupabaseClient
): Promise<TaskWithWorkstream[]> {
  const supabase = await getSupabase(client)
  let { data, error } = await runTasksQuery(supabase, filters, {
    includeDueTimeOrder: true,
  })

  if (isMissingDueTimeColumnError(error)) {
    ;({ data, error } = await runTasksQuery(supabase, filters, {
      includeDueTimeOrder: false,
    }))
  }

  if (isMissingTaskProjectManagementColumnError(error)) {
    ;({ data, error } = await runTasksQuery(supabase, filters, {
      includeDueTimeOrder: false,
      legacySchema: true,
    }))
  }

  if (error) {
    throw new Error(error.message || 'Failed to load tasks')
  }

  return ((data ?? []) as unknown as TaskRowWithJoin[]).map(mapTaskWithWorkstream)
}

export async function createTask(
  input: CreateTaskInput,
  client?: SupabaseClient
): Promise<TaskWithWorkstream> {
  const supabase = await getSupabase(client)
  const title = input.title.trim()

  if (!title) {
    throw new Error('title is required')
  }

  if (!input.workstream_id && !input.is_master_todo) {
    throw new Error('workstream_id is required unless is_master_todo is true')
  }

  let columnId = input.column_id ?? null
  if (!columnId && input.workstream_id) {
    columnId = await resolveDefaultColumnId(input.workstream_id, supabase)
  }

  const payload = {
    workstream_id: input.workstream_id ?? null,
    column_id: columnId,
    account_id: input.account_id ?? null,
    contact_id: input.contact_id ?? null,
    project_id: input.project_id ?? null,
    parent_task_id: input.parent_task_id ?? null,
    title,
    description: input.description?.trim() || null,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'medium',
    owner: input.owner?.trim() || null,
    start_date: input.start_date ?? null,
    due_date: input.due_date ?? null,
    due_time: input.due_time ?? null,
    estimated_hours: input.estimated_hours ?? null,
    actual_hours: input.actual_hours ?? null,
    is_master_todo: input.is_master_todo ?? false,
    tags: input.tags ?? [],
    sort_order: input.sort_order ?? 0,
    order_index: input.order_index ?? input.sort_order ?? 0,
    custom_fields: input.custom_fields ?? {},
  }

  let { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select(TASK_SELECT_FULL)
    .single()

  if (isMissingDueTimeColumnError(error) || isMissingTaskProjectManagementColumnError(error)) {
    const fallbackPayload = {
      workstream_id: payload.workstream_id,
      column_id: payload.column_id,
      account_id: payload.account_id,
      contact_id: payload.contact_id,
      project_id: payload.project_id,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      start_date: payload.start_date,
      due_date: payload.due_date,
      is_master_todo: payload.is_master_todo,
      tags: payload.tags,
      sort_order: payload.sort_order,
      completed_at: payload.status === 'done' ? new Date().toISOString() : null,
    }

    ;({ data, error } = await supabase
      .from('tasks')
      .insert(fallbackPayload)
      .select(TASK_SELECT_LEGACY)
      .single())
  }

  if (error) {
    throw new Error(error.message || 'Failed to create task')
  }

  return mapTaskWithWorkstream(data as TaskRowWithJoin)
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  client?: SupabaseClient
): Promise<TaskWithWorkstream> {
  const supabase = await getSupabase(client)

  const patch: Partial<Task> = {}

  if (input.workstream_id !== undefined) {
    patch.workstream_id = input.workstream_id
  }

  if (input.column_id !== undefined) {
    patch.column_id = input.column_id
  } else if (input.workstream_id) {
    patch.column_id = await resolveDefaultColumnId(input.workstream_id, supabase)
  }

  if (input.contact_id !== undefined) {
    patch.contact_id = input.contact_id
  }

  if (input.account_id !== undefined) {
    patch.account_id = input.account_id
  }

  if (input.project_id !== undefined) {
    patch.project_id = input.project_id
  }

  if (input.parent_task_id !== undefined) {
    patch.parent_task_id = input.parent_task_id
  }

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) {
      throw new Error('title cannot be empty')
    }
    patch.title = title
  }

  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null
  }

  if (input.priority !== undefined) {
    patch.priority = input.priority
  }

  if (input.status !== undefined) {
    patch.status = input.status
  }

  if (input.owner !== undefined) {
    patch.owner = input.owner?.trim() || null
  }

  if (input.start_date !== undefined) {
    patch.start_date = input.start_date
  }

  if (input.due_date !== undefined) {
    patch.due_date = input.due_date
  }

  if (input.due_time !== undefined) {
    patch.due_time = input.due_time
  }

  if (input.estimated_hours !== undefined) {
    patch.estimated_hours = input.estimated_hours
  }

  if (input.actual_hours !== undefined) {
    patch.actual_hours = input.actual_hours
  }

  if (input.is_master_todo !== undefined) {
    patch.is_master_todo = input.is_master_todo
  }

  if (input.tags !== undefined) {
    patch.tags = input.tags
  }

  if (input.sort_order !== undefined) {
    patch.sort_order = input.sort_order
  }

  if (input.order_index !== undefined) {
    patch.order_index = input.order_index
  }

  if (input.custom_fields !== undefined) {
    patch.custom_fields = input.custom_fields
  }

  if (input.completed_at !== undefined) {
    patch.completed_at = input.completed_at
  }

  let { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_SELECT_FULL)
    .single()

  if (isMissingDueTimeColumnError(error) || isMissingTaskProjectManagementColumnError(error)) {
    const fallbackPatch: Partial<Task> = {
      workstream_id: patch.workstream_id,
      column_id: patch.column_id,
      contact_id: patch.contact_id,
      account_id: patch.account_id,
      project_id: patch.project_id,
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      start_date: patch.start_date,
      due_date: patch.due_date,
      is_master_todo: patch.is_master_todo,
      tags: patch.tags,
      sort_order: patch.sort_order,
      completed_at:
        input.status !== undefined
          ? input.status === 'done'
            ? patch.completed_at ?? new Date().toISOString()
            : null
          : patch.completed_at,
    }

    ;({ data, error } = await supabase
      .from('tasks')
      .update(fallbackPatch)
      .eq('id', id)
      .select(TASK_SELECT_LEGACY)
      .single())
  }

  if (error) {
    throw new Error(error.message || 'Failed to update task')
  }

  return mapTaskWithWorkstream(data as TaskRowWithJoin)
}

export async function deleteTask(
  id: string,
  options: { hardDelete?: boolean } = {},
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)

  if (options.hardDelete) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      throw new Error(error.message || 'Failed to delete task')
    }
    return
  }

  const { error } = await supabase
    .from('tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to complete task')
  }
}

export async function reorderTasks(
  updates: ReorderTaskUpdate[],
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)

  try {
    await Promise.all(
      updates.map(async (update) => {
        const { error } = await supabase
          .from('tasks')
          .update({
            sort_order: update.sort_order,
            order_index: update.order_index ?? update.sort_order,
            column_id: update.column_id ?? null,
            ...(update.status ? { status: update.status } : {}),
          })
          .eq('id', update.id)

        if (error) {
          throw new Error(error.message || `Failed to reorder task ${update.id}`)
        }
      })
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder tasks'
    if (!isMissingTaskProjectManagementColumnError({ message })) {
      throw error
    }

    await Promise.all(
      updates.map(async (update) => {
        const { error: fallbackError } = await supabase
          .from('tasks')
          .update({
            sort_order: update.sort_order,
            column_id: update.column_id ?? null,
            ...(update.status
              ? { completed_at: update.status === 'done' ? new Date().toISOString() : null }
              : {}),
          })
          .eq('id', update.id)

        if (fallbackError) {
          throw new Error(fallbackError.message || `Failed to reorder task ${update.id}`)
        }
      })
    )
  }
}
