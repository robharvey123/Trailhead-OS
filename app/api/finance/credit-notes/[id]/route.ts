import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params)
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowedFields = ['credit_note_number', 'invoice_id', 'account_id', 'direction', 'status', 'issue_date', 'tax_rate', 'currency', 'reason', 'line_items', 'notes']
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  // Recalculate totals if line items changed
  if (body.line_items) {
    const subtotal = body.line_items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
    const taxRate = parseFloat(body.tax_rate ?? updates.tax_rate as string) || 0
    updates.subtotal = subtotal
    updates.tax_amount = subtotal * (taxRate / 100)
    updates.total = subtotal + (updates.tax_amount as number)
  }

  const { data: cn, error } = await auth.ctx.supabase
    .from('finance_credit_notes')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credit_note: cn })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params)
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase
    .from('finance_credit_notes')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
