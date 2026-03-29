import { NextRequest, NextResponse } from 'next/server'
import {
  addDays,
  getColumnIdForWorkstream,
  getWorkstreamBySlug,
  jsonError,
  mapTask,
  optionalDate,
  optionalString,
  parseBooleanParam,
  parsePriority,
  parseTaskDueFilter,
  requiredString,
  requireCoworkAuth,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const priorityParam = searchParams.get('priority')
    const due = parseTaskDueFilter(searchParams.get('due'))
    const master = parseBooleanParam(searchParams.get('master'))
    const today = todayDate()
    const tomorrow = addDays(today, 1)
    const weekEnd = addDays(today, 7)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('tasks')
      .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    if (priorityParam) {
      query = query.eq('priority', parsePriority(priorityParam))
    }

    if (master === true) {
      query = query.eq('is_master_todo', true)
    }

    if (due === 'today') {
      query = query.eq('due_date', today)
    }

    if (due === 'overdue') {
      query = query.lt('due_date', today).is('completed_at', null)
    }

    if (due === 'this_week') {
      query = query.gte('due_date', tomorrow).lte('due_date', weekEnd)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json((data ?? []).map((row) => mapTask(row)))
  } catch (error) {
    return jsonError(error, 'Failed to load tasks')
  }
}

export async function POST(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = requiredString(body.title, 'title')
    const workstream = await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))
    const backlogColumnId = await getColumnIdForWorkstream(workstream.id, 'backlog')
    const priority = parsePriority(body.priority)
    const dueDate = optionalDate(body.due_date, 'due_date')
    const description = optionalString(body.description)
    const isMasterTodo = body.is_master_todo === true

    const { data, error } = await supabaseService
      .from('tasks')
      .insert({
        title,
        workstream_id: workstream.id,
        column_id: backlogColumnId,
        priority,
        due_date: dueDate,
        description,
        is_master_todo: isMasterTodo,
      })
      .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapTask(data), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create task')
  }
}
