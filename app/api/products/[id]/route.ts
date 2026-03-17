import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const updates: Record<string, unknown> = {}
  const allowed = ['name', 'sku', 'brand', 'category', 'description', 'unit_cost', 'unit_price', 'weight_grams', 'status', 'attributes', 'tags', 'image_url', 'barcode']
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const { data, error } = await auth.ctx.supabase.from('products').update(updates).eq('id', id).eq('workspace_id', workspaceId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase.from('products').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
