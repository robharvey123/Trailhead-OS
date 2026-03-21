import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase
    .from('finance_credit_notes')
    .select('*, crm_accounts(name)')
    .eq('workspace_id', workspaceId)
    .order('issue_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const creditNotes = (data || []).map((cn: Record<string, unknown>) => ({
    ...cn,
    account_name: (cn.crm_accounts as Record<string, unknown> | null)?.name || null,
    crm_accounts: undefined,
  }))

  return NextResponse.json({ credit_notes: creditNotes })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const lineItems = body.line_items || []
  const subtotal = lineItems.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const taxRate = parseFloat(body.tax_rate) || 0
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const { data: cn, error } = await supabase
    .from('finance_credit_notes')
    .insert({
      workspace_id: workspaceId,
      credit_note_number: body.credit_note_number || '',
      invoice_id: body.invoice_id || null,
      account_id: body.account_id || null,
      direction: body.direction || 'outgoing',
      status: body.status || 'draft',
      issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      currency: body.currency || 'GBP',
      reason: body.reason || null,
      line_items: lineItems,
      notes: body.notes || null,
      created_by: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credit_note: cn }, { status: 201 })
}
