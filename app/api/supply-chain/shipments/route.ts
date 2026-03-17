import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = request.nextUrl.searchParams.get('status')
  let query = auth.ctx.supabase.from('shipments').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shipments: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('shipments').insert({
    workspace_id: workspaceId,
    supply_order_id: body.supply_order_id || null,
    reference_number: body.reference_number || null,
    carrier: body.carrier || null,
    tracking_number: body.tracking_number || null,
    status: body.status || 'pending',
    ship_date: body.ship_date || null,
    estimated_delivery: body.estimated_delivery || null,
    origin_address: body.origin_address || null,
    destination_address: body.destination_address || null,
    line_items: body.line_items || [],
    notes: body.notes || null,
    created_by: auth.ctx.userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shipment: data }, { status: 201 })
}
