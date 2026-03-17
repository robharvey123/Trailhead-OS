import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const updates: Record<string, unknown> = {}
  const allowed = ['product_id', 'variant_id', 'warehouse', 'qty_on_hand', 'qty_reserved', 'reorder_point', 'reorder_qty', 'unit_cost', 'last_counted_at']
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const { data, error } = await auth.ctx.supabase.from('inventory').update(updates).eq('id', id).eq('workspace_id', workspaceId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase.from('inventory').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
