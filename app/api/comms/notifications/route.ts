import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true'
  let query = auth.ctx.supabase.from('notifications').select('*').eq('workspace_id', workspaceId).eq('user_id', auth.ctx.userId).order('created_at', { ascending: false }).limit(100)
  if (unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (body.mark_all_read) {
    const { error } = await auth.ctx.supabase.from('notifications').update({ is_read: true }).eq('workspace_id', workspaceId).eq('user_id', auth.ctx.userId).eq('is_read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { data, error } = await auth.ctx.supabase.from('notifications').update({ is_read: body.is_read ?? true }).eq('id', body.id).eq('workspace_id', workspaceId).eq('user_id', auth.ctx.userId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notification: data })
  }

  return NextResponse.json({ error: 'id or mark_all_read required' }, { status: 400 })
}
