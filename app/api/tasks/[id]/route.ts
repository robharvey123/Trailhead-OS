import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { deleteTask as deleteOsTask, updateTask as updateOsTask } from '@/lib/db/tasks'
import type { TaskPriority, UpdateTaskInput } from '@/lib/types'
import { normalizeWorkspaceTaskCategory } from '@/lib/workspace/constants'
import {
  createRecurringTaskCopies,
  parseChecklistItems,
  parseDate,
  parseHexColor,
  parseRecurrencePayload,
  parseTime,
} from '@/lib/workspace/task-payload'
import { insertTaskActivity } from '@/lib/workspace/task-relations'

const TASK_STATUSES = new Set(['open', 'assigned', 'in_progress', 'done', 'cancelled'])
const PRIORITIES = new Set(['low', 'medium', 'high'])
const OS_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const SERIES_SHARED_FIELDS = new Set([
  'title', 'description', 'category', 'planned_start_time', 'task_color',
  'duration_minutes', 'required_people', 'priority', 'checklist_items',
])

async function getAuthenticatedSupabase() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { supabase, user, response: null }
}

async function patchOsTask(request: NextRequest, id: string) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const patch: UpdateTaskInput = {}

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    }
    patch.title = body.title
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 })
    }
    patch.description = body.description
  }

  if (body.workstream_id !== undefined) {
    if (body.workstream_id !== null && typeof body.workstream_id !== 'string') {
      return NextResponse.json({ error: 'workstream_id must be a string or null' }, { status: 400 })
    }
    patch.workstream_id = body.workstream_id
  }

  if (body.column_id !== undefined) {
    if (body.column_id !== null && typeof body.column_id !== 'string') {
      return NextResponse.json({ error: 'column_id must be a string or null' }, { status: 400 })
    }
    patch.column_id = body.column_id
  }

  if (body.contact_id !== undefined) {
    if (body.contact_id !== null && typeof body.contact_id !== 'string') {
      return NextResponse.json({ error: 'contact_id must be a string or null' }, { status: 400 })
    }
    patch.contact_id = body.contact_id
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== 'string') {
      return NextResponse.json({ error: 'priority must be a string' }, { status: 400 })
    }

    const priority = body.priority.toLowerCase() as TaskPriority
    if (!OS_PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'priority must be low, medium, high, or urgent' }, { status: 400 })
    }

    patch.priority = priority
  }

  if (body.due_date !== undefined) {
    if (body.due_date !== null && typeof body.due_date !== 'string') {
      return NextResponse.json({ error: 'due_date must be a string or null' }, { status: 400 })
    }
    patch.due_date = body.due_date
  }

  if (body.is_master_todo !== undefined) {
    if (typeof body.is_master_todo !== 'boolean') {
      return NextResponse.json({ error: 'is_master_todo must be a boolean' }, { status: 400 })
    }
    patch.is_master_todo = body.is_master_todo
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((tag: unknown) => typeof tag !== 'string')) {
      return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
    }
    patch.tags = body.tags
  }

  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== 'number') {
      return NextResponse.json({ error: 'sort_order must be a number' }, { status: 400 })
    }
    patch.sort_order = body.sort_order
  }

  if (body.completed_at !== undefined) {
    if (body.completed_at !== null && typeof body.completed_at !== 'string') {
      return NextResponse.json({ error: 'completed_at must be a string or null' }, { status: 400 })
    }
    patch.completed_at = body.completed_at
  } else if (body.completed !== undefined) {
    if (typeof body.completed !== 'boolean') {
      return NextResponse.json({ error: 'completed must be a boolean' }, { status: 400 })
    }
    patch.completed_at = body.completed ? new Date().toISOString() : null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const task = await updateOsTask(id, patch, auth.supabase)
    return NextResponse.json({ task })
  } catch (error) {
    if (error instanceof Error && error.message === 'JSON object requested, multiple (or no) rows returned') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    )
  }
}

async function deleteOsTaskRoute(request: NextRequest, id: string) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const hardDelete = body.hard_delete === true || body.hardDelete === true

  try {
    await deleteOsTask(id, { hardDelete }, auth.supabase)
    return NextResponse.json({ deletedTaskIds: [id], hardDelete })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete task' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  if (!workspaceId) {
    return patchOsTask(request, id)
  }
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const updateScope = request.nextUrl.searchParams.get('scope') === 'series' ? 'series' : 'single'

  const existing = await supabase
    .from('workspace_tasks')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  const recurrence = parseRecurrencePayload(body)

  if (typeof body.title === 'string') {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    patch.title = title
  }
  if (body.description === null || typeof body.description === 'string') {
    patch.description = body.description === null ? null : body.description.trim()
  }
  if (body.status) {
    const status = String(body.status).toLowerCase()
    if (!TASK_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    patch.status = status
  }
  if (body.priority) {
    const priority = String(body.priority).toLowerCase()
    if (!PRIORITIES.has(priority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    patch.priority = priority
  }
  if (body.category !== undefined) {
    if (body.category === null || body.category === '') {
      patch.category = null
    } else {
      const category = normalizeWorkspaceTaskCategory(body.category)
      if (!category) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      patch.category = category
    }
  }
  if (body.duration_minutes !== undefined) {
    const duration = Number(body.duration_minutes)
    if (!Number.isFinite(duration) || duration <= 0) return NextResponse.json({ error: 'duration_minutes must be > 0' }, { status: 400 })
    patch.duration_minutes = Math.round(duration)
  }
  if (body.planned_start_time !== undefined) {
    if (body.planned_start_time === null || body.planned_start_time === '') {
      patch.planned_start_time = null
    } else {
      const t = parseTime(body.planned_start_time)
      if (!t) return NextResponse.json({ error: 'planned_start_time must be HH:MM or HH:MM:SS' }, { status: 400 })
      patch.planned_start_time = t
    }
  }
  if (body.task_color !== undefined) {
    if (body.task_color === null || body.task_color === '') {
      patch.task_color = null
    } else {
      const c = parseHexColor(body.task_color)
      if (!c) return NextResponse.json({ error: 'task_color must be a hex color like #a855f7' }, { status: 400 })
      patch.task_color = c
    }
  }
  if (body.required_people !== undefined) {
    const rp = Number(body.required_people)
    if (!Number.isFinite(rp) || rp <= 0) return NextResponse.json({ error: 'required_people must be > 0' }, { status: 400 })
    patch.required_people = Math.round(rp)
  }
  if (body.checklist_items !== undefined) {
    const cl = parseChecklistItems(body.checklist_items)
    if (cl === null) return NextResponse.json({ error: 'checklist_items must be an array' }, { status: 400 })
    patch.checklist_items = cl
  }
  if ('error' in recurrence) {
    return NextResponse.json({ error: recurrence.error }, { status: 400 })
  }
  if (body.recurrence_cadence !== undefined || body.recurrence_interval !== undefined || body.recurrence_end_date !== undefined) {
    patch.recurrence_cadence = recurrence.cadence
    patch.recurrence_interval = recurrence.interval
    patch.recurrence_end_date = recurrence.endDate
  }
  if (body.sort_order !== undefined) {
    const so = Number(body.sort_order)
    if (!Number.isFinite(so)) return NextResponse.json({ error: 'sort_order must be a number' }, { status: 400 })
    patch.sort_order = Math.round(so)
  }
  if (body.scheduled_date !== undefined) {
    const sd = parseDate(body.scheduled_date)
    if (!sd) return NextResponse.json({ error: 'scheduled_date must be YYYY-MM-DD' }, { status: 400 })
    patch.scheduled_date = sd
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  // Series update
  if (updateScope === 'series') {
    const seriesRootId = existing.data.recurrence_parent_task_id || existing.data.id
    const hasRecurringSeries = Boolean(existing.data.recurrence_parent_task_id || existing.data.recurrence_cadence)
    if (!hasRecurringSeries) return NextResponse.json({ error: 'Not part of a repeating series' }, { status: 400 })

    const seriesTaskIds = [seriesRootId]
    const children = await supabase.from('workspace_tasks').select('id').eq('workspace_id', workspaceId).eq('recurrence_parent_task_id', seriesRootId)
    if (children.error) return NextResponse.json({ error: children.error.message }, { status: 500 })
    for (const row of children.data || []) { if (row.id !== seriesRootId) seriesTaskIds.push(row.id) }

    const sharedPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => SERIES_SHARED_FIELDS.has(key)))
    const rootPatch: Record<string, unknown> = {}
    if (patch.recurrence_cadence !== undefined) rootPatch.recurrence_cadence = patch.recurrence_cadence
    if (patch.recurrence_interval !== undefined) rootPatch.recurrence_interval = patch.recurrence_interval
    if (patch.recurrence_end_date !== undefined) rootPatch.recurrence_end_date = patch.recurrence_end_date

    if (Object.keys(sharedPatch).length === 0 && Object.keys(rootPatch).length === 0) {
      return NextResponse.json({ error: 'No series-applicable changes' }, { status: 400 })
    }

    if (Object.keys(sharedPatch).length > 0) {
      const upd = await supabase.from('workspace_tasks').update(sharedPatch).in('id', seriesTaskIds).eq('workspace_id', workspaceId)
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 })
    }

    let rootTask = existing.data
    if (Object.keys(rootPatch).length > 0) {
      const upd = await supabase.from('workspace_tasks').update(rootPatch).eq('id', seriesRootId).eq('workspace_id', workspaceId).select('*').single()
      if (upd.error || !upd.data) return NextResponse.json({ error: upd.error?.message || 'Failed' }, { status: 500 })
      rootTask = upd.data
    } else if (seriesRootId !== existing.data.id) {
      const r = await supabase.from('workspace_tasks').select('*').eq('id', seriesRootId).eq('workspace_id', workspaceId).single()
      if (r.data) rootTask = r.data
    }

    if (!rootTask.recurrence_parent_task_id && rootTask.recurrence_cadence && rootTask.recurrence_end_date) {
      await createRecurringTaskCopies({
        supabase, workspaceId, userId, parentTaskId: rootTask.id,
        seedTask: {
          scheduled_date: rootTask.scheduled_date, title: rootTask.title, description: rootTask.description,
          category: rootTask.category, planned_start_time: rootTask.planned_start_time, task_color: rootTask.task_color,
          duration_minutes: rootTask.duration_minutes, required_people: rootTask.required_people, priority: rootTask.priority,
          status: rootTask.status, sort_order: rootTask.sort_order ?? 0, checklist_items: rootTask.checklist_items || [],
          recurrence_cadence: rootTask.recurrence_cadence, recurrence_interval: rootTask.recurrence_interval || 1,
          recurrence_end_date: rootTask.recurrence_end_date,
        },
      })
    }

    const current = await supabase.from('workspace_tasks').select('*').eq('id', id).eq('workspace_id', workspaceId).single()
    await insertTaskActivity(supabase, { workspaceId, taskId: seriesRootId, actorProfileId: userId, action: 'task_series_updated', details: { task_id: id, changed_fields: Object.keys(patch) } })
    return NextResponse.json({ task: current.data || existing.data })
  }

  // Single update
  const { data, error } = await supabase.from('workspace_tasks').update(patch).eq('id', id).eq('workspace_id', workspaceId).select('*').single()
  if (error) return NextResponse.json({ error: error.message || 'Failed to update task' }, { status: 500 })

  const isSeriesRoot = !existing.data.recurrence_parent_task_id
  if (isSeriesRoot && data.recurrence_cadence && data.recurrence_end_date) {
    await createRecurringTaskCopies({
      supabase, workspaceId, userId, parentTaskId: data.id,
      seedTask: {
        scheduled_date: data.scheduled_date, title: data.title, description: data.description,
        category: data.category, planned_start_time: data.planned_start_time, task_color: data.task_color,
        duration_minutes: data.duration_minutes, required_people: data.required_people, priority: data.priority,
        status: data.status, sort_order: data.sort_order ?? 0, checklist_items: data.checklist_items || [],
        recurrence_cadence: data.recurrence_cadence, recurrence_interval: data.recurrence_interval || 1,
        recurrence_end_date: data.recurrence_end_date,
      },
    })
  }

  await insertTaskActivity(supabase, { workspaceId, taskId: data.id, actorProfileId: userId, action: 'task_updated', details: { changed_fields: Object.keys(patch) } })
  return NextResponse.json({ task: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  if (!workspaceId) {
    return deleteOsTaskRoute(request, id)
  }
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const scope = request.nextUrl.searchParams.get('scope') === 'series' ? 'series' : 'single'

  const existing = await supabase.from('workspace_tasks').select('id, workspace_id, recurrence_parent_task_id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  if (existing.error || !existing.data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (scope === 'series') {
    const rootId = existing.data.recurrence_parent_task_id || existing.data.id
    const children = await supabase.from('workspace_tasks').select('id').eq('workspace_id', workspaceId).eq('recurrence_parent_task_id', rootId)
    if (children.error) return NextResponse.json({ error: children.error.message }, { status: 500 })
    const taskIds = [
      rootId,
      ...(children.data || [])
        .map((row) => row.id)
        .filter((taskId: string) => taskId !== rootId),
    ]

    await supabase.from('workspace_assignments').delete().in('task_id', taskIds)
    const del = await supabase.from('workspace_tasks').delete().eq('workspace_id', workspaceId).in('id', taskIds)
    if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
    return NextResponse.json({ deletedTaskIds: taskIds, scope })
  }

  if (!existing.data.recurrence_parent_task_id) {
    const childCount = await supabase.from('workspace_tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('recurrence_parent_task_id', existing.data.id)
    if ((childCount.count || 0) > 0) {
      return NextResponse.json({ error: 'This is the root of a series. Delete the whole series instead.' }, { status: 400 })
    }
  }

  await supabase.from('workspace_assignments').delete().eq('task_id', existing.data.id)
  const del = await supabase.from('workspace_tasks').delete().eq('id', existing.data.id).eq('workspace_id', workspaceId)
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
  return NextResponse.json({ deletedTaskIds: [existing.data.id], scope })
}
