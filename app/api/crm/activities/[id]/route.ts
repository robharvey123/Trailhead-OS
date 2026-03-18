import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase
    .from('crm_activities')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
