import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
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

const PRIORITIES = new Set(['low', 'medium', 'high'])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const workspaceId = String(body.workspace_id || '').trim()
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const title = String(body.title || '').trim()
  const description = body.description ? String(body.description).trim() : null
  const durationMinutes = Number(body.duration_minutes || 60)
  const requiredPeople = Number(body.required_people || 1)
  const priority = String(body.priority || 'medium').toLowerCase()
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
  const category = body.category === undefined ? null : normalizeWorkspaceTaskCategory(body.category)
  const plannedStartTime = body.planned_start_time === undefined ? null : parseTime(body.planned_start_time)
  const taskColor = body.task_color === undefined ? null : parseHexColor(body.task_color)
  const checklistItems = parseChecklistItems(body.checklist_items)
  const recurrence = parseRecurrencePayload(body)
  const scheduledDate = parseDate(body.scheduled_date)

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!scheduledDate) return NextResponse.json({ error: 'scheduled_date is required (YYYY-MM-DD)' }, { status: 400 })
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return NextResponse.json({ error: 'duration_minutes must be greater than zero' }, { status: 400 })
  }
  if (!Number.isFinite(requiredPeople) || requiredPeople <= 0) {
    return NextResponse.json({ error: 'required_people must be greater than zero' }, { status: 400 })
  }
  if (!PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'priority must be low, medium or high' }, { status: 400 })
  }
  if (body.category !== undefined && body.category !== null && body.category !== '' && !category) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (body.planned_start_time !== undefined && body.planned_start_time !== null && body.planned_start_time !== '' && !plannedStartTime) {
    return NextResponse.json({ error: 'planned_start_time must be HH:MM or HH:MM:SS' }, { status: 400 })
  }
  if (body.task_color !== undefined && body.task_color !== null && body.task_color !== '' && !taskColor) {
    return NextResponse.json({ error: 'task_color must be a hex color like #a855f7' }, { status: 400 })
  }
  if (checklistItems === null) {
    return NextResponse.json({ error: 'checklist_items must be an array of checklist entries' }, { status: 400 })
  }
  if ('error' in recurrence) {
    return NextResponse.json({ error: recurrence.error }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workspace_tasks')
    .insert({
      workspace_id: workspaceId,
      scheduled_date: scheduledDate,
      title,
      description,
      category,
      planned_start_time: plannedStartTime,
      task_color: taskColor,
      duration_minutes: Math.round(durationMinutes),
      required_people: Math.round(requiredPeople),
      priority,
      status: 'open',
      sort_order: sortOrder,
      checklist_items: checklistItems,
      recurrence_cadence: recurrence.cadence,
      recurrence_interval: recurrence.interval,
      recurrence_end_date: recurrence.endDate,
      created_by: userId,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 })
  }

  await createRecurringTaskCopies({
    supabase,
    workspaceId,
    userId,
    parentTaskId: data.id,
    seedTask: {
      scheduled_date: data.scheduled_date,
      title: data.title,
      description: data.description,
      category: data.category,
      planned_start_time: data.planned_start_time,
      task_color: data.task_color,
      duration_minutes: data.duration_minutes,
      required_people: data.required_people,
      priority: data.priority,
      status: data.status,
      sort_order: data.sort_order ?? 0,
      checklist_items: data.checklist_items || [],
      recurrence_cadence: data.recurrence_cadence,
      recurrence_interval: data.recurrence_interval || 1,
      recurrence_end_date: data.recurrence_end_date,
    },
  })

  await insertTaskActivity(supabase, {
    workspaceId,
    taskId: data.id,
    actorProfileId: userId,
    action: 'task_created',
    details: { title: data.title, scheduled_date: data.scheduled_date, recurring: Boolean(data.recurrence_cadence) },
  })

  return NextResponse.json({ task: data })
}
