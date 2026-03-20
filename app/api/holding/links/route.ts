import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  const { data, error } = await supabase
    .from('workspace_links')
    .select('*, linked:workspaces!workspace_links_linked_workspace_id_fkey(name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const links = (data || []).map((l: Record<string, unknown>) => ({
    ...l,
    linked_workspace_name: (l.linked as { name: string } | null)?.name ?? null,
    linked: undefined,
  }))

  return NextResponse.json({ links })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Verify user is also a member of the target workspace
  const linkedId = body.linked_workspace_id
  if (!linkedId) return NextResponse.json({ error: 'linked_workspace_id is required' }, { status: 400 })

  const { data: member } = await auth.ctx.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', linkedId)
    .eq('user_id', auth.ctx.userId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'You must be a member of the linked workspace' }, { status: 403 })

  const { data, error } = await auth.ctx.supabase.from('workspace_links').insert({
    workspace_id: workspaceId,
    linked_workspace_id: linkedId,
    label: body.label || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const linkId = request.nextUrl.searchParams.get('id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase.from('workspace_links').delete().eq('id', linkId).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
