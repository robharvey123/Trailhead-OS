import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { loadTaskDependencyMaps } from '@/lib/workspace/task-relations'
import { parseTime } from '@/lib/workspace/task-payload'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { createTask, getTasks } from '@/lib/db/tasks'
import type { CreateTaskInput, TaskPriority } from '@/lib/types'

const OS_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return undefined
}

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

async function handleOsGet(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const limitValue = searchParams.get('limit')
    const tasks = await getTasks(
      {
        workstream_id: searchParams.get('workstream_id'),
        column_id: searchParams.get('column_id'),
        account_id: searchParams.get('account_id'),
        contact_id: searchParams.get('contact_id'),
        is_master_todo: parseBoolean(searchParams.get('is_master_todo')),
        due_date_from: searchParams.get('due_date_from') ?? searchParams.get('date_from'),
        due_date_to: searchParams.get('due_date_to') ?? searchParams.get('date_to'),
        include_completed: parseBoolean(searchParams.get('include_completed')) ?? false,
        completed: parseBoolean(searchParams.get('completed')),
        limit: limitValue ? Number(limitValue) : undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ tasks })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load tasks' },
      { status: 500 }
    )
  }
}

async function handleWorkspaceGet(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const searchParams = request.nextUrl.searchParams
  const dateFrom = String(searchParams.get('date_from') || '').trim()
  const dateTo = String(searchParams.get('date_to') || '').trim()

  let tasksQuery = supabase
    .from('workspace_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('scheduled_date', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    tasksQuery = tasksQuery.gte('scheduled_date', dateFrom)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    tasksQuery = tasksQuery.lte('scheduled_date', dateTo)
  }

  const tasksRes = await tasksQuery
  if (tasksRes.error) {
    return NextResponse.json({ error: tasksRes.error.message || 'Failed to load tasks' }, { status: 500 })
  }

  const tasks = tasksRes.data || []
  const taskIds = tasks.map((task) => String(task.id)).filter(Boolean)

  if (taskIds.length === 0) {
    return NextResponse.json({ tasks: [] })
  }

  const [assignmentsRes, dependencyMaps] = await Promise.all([
    supabase
      .from('workspace_assignments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('task_id', taskIds),
    loadTaskDependencyMaps(supabase, workspaceId, taskIds),
  ])

  const firstError = assignmentsRes.error || dependencyMaps.error
  if (firstError) {
    return NextResponse.json({ error: firstError.message || 'Failed to load task data' }, { status: 500 })
  }

  const assigneeIds = Array.from(
    new Set((assignmentsRes.data || []).map((assignment) => String(assignment.profile_id || '')).filter(Boolean))
  )

  let profiles: Array<{ id: string; full_name: string | null; email: string | null }> = []
  if (assigneeIds.length > 0) {
    const profilesRes = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', assigneeIds)

    if (!profilesRes.error && profilesRes.data) {
      profiles = profilesRes.data.map((member: { user_id: string }) => ({
        id: member.user_id,
        full_name: null,
        email: null,
      }))
    }
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
  const assignmentsByTask = new Map<string, Array<Record<string, unknown>>>()

  for (const assignment of assignmentsRes.data || []) {
    const profile = profileMap.get(assignment.profile_id)
    const existing = assignmentsByTask.get(assignment.task_id) || []
    existing.push({
      ...assignment,
      profile_name: profile?.full_name || profile?.email || 'Member',
      profile_email: profile?.email || null,
    })
    assignmentsByTask.set(assignment.task_id, existing)
  }

  const enrichedTasks = tasks.map((task) => ({
    ...task,
    assignments: assignmentsByTask.get(task.id) || [],
    blocked_by_tasks: dependencyMaps.blockedByByTask.get(task.id) || [],
    blocking_tasks: dependencyMaps.blockingByTask.get(task.id) || [],
  }))

  return NextResponse.json({ tasks: enrichedTasks })
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has('workspace_id')) {
    return handleWorkspaceGet(request)
  }

  return handleOsGet(request)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const workstreamId = typeof body.workstream_id === 'string' ? body.workstream_id : null
  const isMasterTodo = body.is_master_todo === true
  const dueDate =
    body.due_date === null || body.due_date === undefined
      ? null
      : typeof body.due_date === 'string'
        ? body.due_date
        : null
  const dueTime = body.due_time === undefined ? null : parseTime(body.due_time)
  const contactId =
    body.contact_id === null || body.contact_id === undefined
      ? null
      : typeof body.contact_id === 'string'
        ? body.contact_id
        : null
  const accountId =
    body.account_id === null || body.account_id === undefined
      ? null
      : typeof body.account_id === 'string'
        ? body.account_id
        : null
  const priority = typeof body.priority === 'string' ? body.priority.toLowerCase() as TaskPriority : 'medium'
  const tags = Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : []

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (!workstreamId && !isMasterTodo) {
    return NextResponse.json(
      { error: 'workstream_id is required unless is_master_todo is true' },
      { status: 400 }
    )
  }

  if (!OS_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: 'priority must be low, medium, high, or urgent' }, { status: 400 })
  }

  if (body.due_time !== undefined && body.due_time !== null && body.due_time !== '' && !dueTime) {
    return NextResponse.json({ error: 'due_time must be HH:MM or HH:MM:SS' }, { status: 400 })
  }

  if (dueTime && !dueDate) {
    return NextResponse.json({ error: 'due_date is required when due_time is supplied' }, { status: 400 })
  }

  const input: CreateTaskInput = {
    title,
    workstream_id: workstreamId,
    column_id: typeof body.column_id === 'string' ? body.column_id : null,
    account_id: accountId,
    contact_id: contactId,
    description: typeof body.description === 'string' ? body.description : null,
    priority,
    due_date: dueDate,
    due_time: dueDate ? dueTime : null,
    is_master_todo: isMasterTodo,
    tags,
    sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
  }

  try {
    const task = await createTask(input, auth.supabase)
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    )
  }
}
