import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('inventory').select('*, products(name, sku)').eq('workspace_id', workspaceId).order('warehouse')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []).map((d: Record<string, unknown>) => {
    const prod = d.products as { name: string; sku: string } | null
    return { ...d, product_name: prod?.name || null, product_sku: prod?.sku || null }
  })
  return NextResponse.json({ inventory: rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('inventory').insert({
    workspace_id: workspaceId,
    product_id: body.product_id || null,
    variant_id: body.variant_id || null,
    warehouse: body.warehouse || 'default',
    qty_on_hand: body.qty_on_hand || 0,
    qty_reserved: body.qty_reserved || 0,
    reorder_point: body.reorder_point || 0,
    reorder_qty: body.reorder_qty || 0,
    unit_cost: body.unit_cost ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}
