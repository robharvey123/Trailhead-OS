import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { insertTaskActivity, loadTaskDependencyMaps } from '@/lib/workspace/task-relations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTask(supabase: any, workspaceId: string, taskId: string) {
  return supabase
    .from('workspace_tasks')
    .select('id, title, status, scheduled_date')
    .eq('id', taskId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  const taskRes = await loadTask(supabase, workspaceId, id)
  if (taskRes.error || !taskRes.data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const maps = await loadTaskDependencyMaps(supabase, workspaceId, [id])
  if (maps.error) return NextResponse.json({ error: maps.error.message }, { status: 500 })

  return NextResponse.json({
    blocked_by_tasks: maps.blockedByByTask.get(id) || [],
    blocking_tasks: maps.blockingByTask.get(id) || [],
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspaceId = String(body.workspace_id || '').trim()

  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const dependsOnTaskId = String(body.depends_on_task_id || '').trim()

  if (!dependsOnTaskId) return NextResponse.json({ error: 'depends_on_task_id is required' }, { status: 400 })
  if (dependsOnTaskId === id) return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 })

  const [taskRes, depRes] = await Promise.all([
    loadTask(supabase, workspaceId, id),
    loadTask(supabase, workspaceId, dependsOnTaskId),
  ])
  if (taskRes.error || !taskRes.data || depRes.error || !depRes.data) {
    return NextResponse.json({ error: 'Both tasks must belong to this workspace' }, { status: 404 })
  }

  // Circular dependency check (BFS)
  const seen = new Set<string>([dependsOnTaskId])
  let frontier = [dependsOnTaskId]
  while (frontier.length > 0) {
    const queryIds = frontier.join(',')
    const edges = await supabase.from('workspace_task_dependencies').select('task_id, depends_on_task_id').eq('workspace_id', workspaceId).or(`task_id.in.(${queryIds})`)
    if (edges.error) return NextResponse.json({ error: edges.error.message }, { status: 500 })

    const nextFrontier: string[] = []
    for (const row of edges.data || []) {
      const childId = String(row.task_id || '')
      const parentId = String(row.depends_on_task_id || '')
      if (!childId || !parentId || !frontier.includes(childId)) continue
      if (parentId === id) return NextResponse.json({ error: 'This would create a dependency loop' }, { status: 400 })
      if (!seen.has(parentId)) { seen.add(parentId); nextFrontier.push(parentId) }
    }
    frontier = nextFrontier
  }

  const ins = await supabase.from('workspace_task_dependencies').insert({ workspace_id: workspaceId, task_id: id, depends_on_task_id: dependsOnTaskId, created_by: userId }).select('id').single()
  if (ins.error) {
    const status = ins.error.code === '23505' ? 409 : 500
    return NextResponse.json({ error: ins.error.message }, { status })
  }

  await insertTaskActivity(supabase, { workspaceId, taskId: id, actorProfileId: userId, action: 'dependency_added', details: { depends_on_task_id: depRes.data.id, depends_on_title: depRes.data.title } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const workspaceId = String(body.workspace_id || '').trim()

  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const dependsOnTaskId = String(body.depends_on_task_id || '').trim()

  if (!dependsOnTaskId) return NextResponse.json({ error: 'depends_on_task_id is required' }, { status: 400 })

  const blocker = await loadTask(supabase, workspaceId, dependsOnTaskId)
  if (blocker.error || !blocker.data) return NextResponse.json({ error: 'Blocking task not found' }, { status: 404 })

  const del = await supabase.from('workspace_task_dependencies').delete().eq('workspace_id', workspaceId).eq('task_id', id).eq('depends_on_task_id', dependsOnTaskId)
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })

  await insertTaskActivity(supabase, { workspaceId, taskId: id, actorProfileId: userId, action: 'dependency_removed', details: { depends_on_task_id: blocker.data.id, depends_on_title: blocker.data.title } })
  return NextResponse.json({ ok: true })
}
