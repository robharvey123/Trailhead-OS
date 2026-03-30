import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  TASK_SELECT,
  addDays,
  formatTask,
  getColumnIdForWorkstream,
  getWorkstreamBySlug,
  jsonError,
  optionalDate,
  optionalString,
  parseBooleanParam,
  parseLimit,
  parsePriority,
  parseTaskDueFilter,
  requiredString,
  sendCoworkTaskNotification,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const projectId = searchParams.get('project_id')
    const priorityParam = searchParams.get('priority')
    const due = parseTaskDueFilter(searchParams.get('due'))
    const master = parseBooleanParam(searchParams.get('master'))
    const limit = parseLimit(searchParams.get('limit'), 50, 200)
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

    if (priorityParam) {
      query = query.eq('priority', parsePriority(priorityParam))
    }

    if (master === true) {
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
      throw error
    }

    return Response.json((data ?? []).map((row) => formatTask(row as never)))
  } catch (error) {
    return jsonError(error, 'Failed to load tasks')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
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
      throw error
    }

    void sendCoworkTaskNotification({
      id: String(data.id),
      title: String(data.title),
    }).catch(() => {})

    return Response.json(formatTask(data as never), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create task')
  }
}
