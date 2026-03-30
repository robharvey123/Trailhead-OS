import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { loadTaskDependencyMaps } from '@/lib/workspace/task-relations'

export async function GET(request: NextRequest) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks = tasksRes.data || [] as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskIds = tasks.map((task: any) => String(task.id)).filter(Boolean)

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Set((assignmentsRes.data || []).map((a: any) => String(a.profile_id || '')).filter(Boolean))
  )

  let profiles: Array<{ id: string; full_name: string | null; email: string | null }> = []
  if (assigneeIds.length > 0) {
    const profilesRes = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', assigneeIds)

    if (!profilesRes.error && profilesRes.data) {
      // Enrich from auth.users isn't directly possible with anon key,
      // so we use the user_id as profile_id and set generic names.
      // In a full implementation you'd join a profiles table.
      profiles = profilesRes.data.map((m: { user_id: string }) => ({
        id: m.user_id,
        full_name: null,
        email: null,
      }))
    }
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentsByTask = new Map<string, Array<any>>()

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedTasks = tasks.map((task: any) => ({
    ...task,
    assignments: assignmentsByTask.get(task.id) || [],
    blocked_by_tasks: dependencyMaps.blockedByByTask.get(task.id) || [],
    blocking_tasks: dependencyMaps.blockingByTask.get(task.id) || [],
  }))

  return NextResponse.json({ tasks: enrichedTasks })
}
