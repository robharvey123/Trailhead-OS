import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const status = request.nextUrl.searchParams.get('status')
  const direction = request.nextUrl.searchParams.get('direction')

  let query = supabase.from('finance_invoices').select('*').eq('workspace_id', workspaceId).order('issue_date', { ascending: false })
  if (status) query = query.eq('status', status)
  if (direction) query = query.eq('direction', direction)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const lineItems = (body.line_items || []).map((item: { id?: string; description: string; quantity: number; unit_price: number }) => ({
    id: item.id || crypto.randomUUID(),
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price,
  }))
  const subtotal = lineItems.reduce((s: number, i: { total: number }) => s + i.total, 0)
  const taxRate = body.tax_rate || 0
  const taxAmount = subtotal * (taxRate / 100)
  const discountAmount = body.discount_amount || 0
  const total = subtotal + taxAmount - discountAmount

  const { data, error } = await supabase.from('finance_invoices').insert({
    workspace_id: workspaceId,
    invoice_number: body.invoice_number,
    account_id: body.account_id || null,
    contact_id: body.contact_id || null,
    direction: body.direction || 'outgoing',
    status: body.status || 'draft',
    issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total,
    amount_paid: body.amount_paid || 0,
    currency: body.currency || 'USD',
    line_items: lineItems,
    notes: body.notes || null,
    payment_terms: body.payment_terms || null,
    stream_id: body.stream_id || null,
    bill_to_name: body.bill_to_name || null,
    bill_to_address: body.bill_to_address || null,
    bill_to_city: body.bill_to_city || null,
    bill_to_postcode: body.bill_to_postcode || null,
    bill_to_country: body.bill_to_country || null,
    bill_to_email: body.bill_to_email || null,
    bill_to_phone: body.bill_to_phone || null,
    bill_to_vat_number: body.bill_to_vat_number || null,
    bill_to_company_number: body.bill_to_company_number || null,
    created_by: userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data }, { status: 201 })
}
