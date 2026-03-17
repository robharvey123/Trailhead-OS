import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = request.nextUrl.searchParams.get('status')
  let query = auth.ctx.supabase.from('supply_orders').select('*, crm_accounts!supply_orders_supplier_account_id_fkey(name)').eq('workspace_id', workspaceId).order('order_date', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const orders = (data || []).map((d: Record<string, unknown>) => ({ ...d, supplier_name: (d.crm_accounts as { name: string } | null)?.name || null }))
  return NextResponse.json({ supply_orders: orders })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('supply_orders').insert({
    workspace_id: workspaceId,
    order_number: body.order_number,
    supplier_account_id: body.supplier_account_id || null,
    purchase_order_id: body.purchase_order_id || null,
    status: body.status || 'pending',
    order_date: body.order_date || new Date().toISOString().slice(0, 10),
    expected_date: body.expected_date || null,
    line_items: body.line_items || [],
    notes: body.notes || null,
    created_by: auth.ctx.userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supply_order: data }, { status: 201 })
}
