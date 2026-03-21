import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const updates: Record<string, unknown> = {}
  const allowed = ['invoice_number', 'account_id', 'contact_id', 'direction', 'status', 'issue_date', 'due_date', 'subtotal', 'tax_rate', 'tax_amount', 'discount_amount', 'total', 'amount_paid', 'currency', 'line_items', 'notes', 'payment_terms', 'stream_id', 'bill_to_name', 'bill_to_address', 'bill_to_city', 'bill_to_postcode', 'bill_to_country', 'bill_to_email', 'bill_to_phone', 'bill_to_vat_number', 'bill_to_company_number']
  for (const key of allowed) { if (key in body) updates[key] = body[key] }

  const { data, error } = await auth.ctx.supabase.from('finance_invoices').update(updates).eq('id', id).eq('workspace_id', workspaceId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoice: data })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase.from('finance_invoices').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
