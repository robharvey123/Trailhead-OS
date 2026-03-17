import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase.from('finance_purchase_orders').select('*').eq('workspace_id', workspaceId).order('order_date', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchase_orders: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const lineItems = (body.line_items || []).map((item: { id?: string; description: string; sku?: string; quantity: number; unit_cost: number }) => ({
    id: item.id || crypto.randomUUID(),
    description: item.description,
    sku: item.sku || null,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
    total: item.quantity * item.unit_cost,
  }))
  const subtotal = lineItems.reduce((s: number, i: { total: number }) => s + i.total, 0)
  const taxAmount = body.tax_amount || 0
  const shippingCost = body.shipping_cost || 0
  const total = subtotal + taxAmount + shippingCost

  const { data, error } = await supabase.from('finance_purchase_orders').insert({
    workspace_id: workspaceId,
    po_number: body.po_number,
    vendor_account_id: body.vendor_account_id || null,
    status: body.status || 'draft',
    order_date: body.order_date || new Date().toISOString().slice(0, 10),
    expected_delivery_date: body.expected_delivery_date || null,
    subtotal,
    tax_amount: taxAmount,
    shipping_cost: shippingCost,
    total,
    currency: body.currency || 'USD',
    line_items: lineItems,
    shipping_address: body.shipping_address || null,
    notes: body.notes || null,
    created_by: userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ purchase_order: data }, { status: 201 })
}
