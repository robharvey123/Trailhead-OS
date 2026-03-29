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
}

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
    title: row.title,
    description: row.description,
    priority: row.priority,
    due_date: row.due_date,
    is_master_todo: row.is_master_todo,
    tags: row.tags ?? [],
    sort_order: row.sort_order,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    workstream_slug: row.workstreams?.slug ?? null,
    workstream_label: row.workstreams?.label ?? null,
    workstream_colour: row.workstreams?.colour ?? null,
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

export async function getTasks(
  filters: TaskFilters = {},
  client?: SupabaseClient
): Promise<TaskWithWorkstream[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('tasks')
    .select('*, workstreams(slug, label, colour)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

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

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load tasks')
  }

  return ((data ?? []) as TaskRowWithJoin[]).map(mapTaskWithWorkstream)
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

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workstream_id: input.workstream_id ?? null,
      column_id: columnId,
      account_id: input.account_id ?? null,
      contact_id: input.contact_id ?? null,
      title,
      description: input.description?.trim() || null,
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
      is_master_todo: input.is_master_todo ?? false,
      tags: input.tags ?? [],
      sort_order: input.sort_order ?? 0,
    })
    .select('*, workstreams(slug, label, colour)')
    .single()

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

  if (input.due_date !== undefined) {
    patch.due_date = input.due_date
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

  if (input.completed_at !== undefined) {
    patch.completed_at = input.completed_at
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select('*, workstreams(slug, label, colour)')
    .single()

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

  await Promise.all(
    updates.map(async (update) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          sort_order: update.sort_order,
          column_id: update.column_id ?? null,
        })
        .eq('id', update.id)

      if (error) {
        throw new Error(error.message || `Failed to reorder task ${update.id}`)
      }
    })
  )
}
