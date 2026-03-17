import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 20)))

  const taskRes = await supabase.from('workspace_tasks').select('id').eq('id', id).eq('workspace_id', workspaceId).maybeSingle()
  if (taskRes.error || !taskRes.data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const activityRes = await supabase
    .from('workspace_task_activity')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('task_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (activityRes.error) return NextResponse.json({ error: activityRes.error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorIds = Array.from(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Set((activityRes.data || []).map((r: any) => String(r.actor_profile_id || '').trim()).filter(Boolean))
  )

  let actorMap = new Map<string, string>()
  if (actorIds.length > 0) {
    // Use workspace_members + auth.users for actor name resolution
    const profilesRes = await supabase
      .from('workspace_members')
      .select('user_id')
      .in('user_id', actorIds)
      .eq('workspace_id', workspaceId)
    if (!profilesRes.error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actorMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, 'Member']))
    }
  }

  return NextResponse.json({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activity: (activityRes.data || []).map((entry: any) => ({
      ...entry,
      actor_name: entry.actor_profile_id ? actorMap.get(entry.actor_profile_id) || 'Member' : 'System',
    })),
  })
}
