import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { insertTaskActivity } from '@/lib/workspace/task-relations'

const ASSIGNMENT_STATUSES = new Set(['assigned', 'accepted', 'declined', 'completed'])

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

  const profileId = String(body.profile_id || '').trim()
  const remove = Boolean(body.remove)
  const status = String(body.status || 'assigned').toLowerCase()

  if (!profileId) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
  if (!remove && !ASSIGNMENT_STATUSES.has(status)) return NextResponse.json({ error: 'Invalid assignment status' }, { status: 400 })

  const taskRes = await supabase.from('workspace_tasks').select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  if (taskRes.error || !taskRes.data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // Verify the assignee is a member of the workspace
  const memberRes = await supabase.from('workspace_members').select('user_id').eq('user_id', profileId).eq('workspace_id', workspaceId).maybeSingle()
  if (memberRes.error || !memberRes.data) return NextResponse.json({ error: 'Member not found in workspace' }, { status: 400 })

  if (remove) {
    const { error } = await supabase.from('workspace_assignments').delete().eq('workspace_id', workspaceId).eq('task_id', id).eq('profile_id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await insertTaskActivity(supabase, { workspaceId, taskId: id, actorProfileId: userId, action: 'owner_removed', details: { profile_id: profileId } })
    return NextResponse.json({ removed: true })
  }

  const { data, error } = await supabase
    .from('workspace_assignments')
    .upsert({ workspace_id: workspaceId, task_id: id, profile_id: profileId, assigned_by: userId, status }, { onConflict: 'task_id,profile_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await insertTaskActivity(supabase, { workspaceId, taskId: id, actorProfileId: userId, action: 'owner_added', details: { profile_id: profileId, status } })

  return NextResponse.json({
    assignment: {
      ...data,
      profile_name: 'Member',
      profile_email: null,
    },
  })
}
