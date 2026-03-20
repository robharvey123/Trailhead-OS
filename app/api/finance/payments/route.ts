import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const invoiceId = request.nextUrl.searchParams.get('invoice_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let query = auth.ctx.supabase
    .from('finance_payments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('payment_date', { ascending: false })

  if (invoiceId) query = query.eq('invoice_id', invoiceId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const amount = parseFloat(body.amount)
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }

  const { data: payment, error } = await supabase
    .from('finance_payments')
    .insert({
      workspace_id: workspaceId,
      invoice_id: body.invoice_id || null,
      purchase_order_id: body.purchase_order_id || null,
      amount,
      currency: body.currency || 'GBP',
      method: body.method || null,
      account_type: body.account_type || 'bank',
      reference_number: body.reference_number || null,
      payment_date: body.payment_date || new Date().toISOString().slice(0, 10),
      notes: body.notes || null,
      recorded_by: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update invoice amount_paid and status
  if (body.invoice_id) {
    const { data: allPayments } = await supabase
      .from('finance_payments')
      .select('amount')
      .eq('invoice_id', body.invoice_id)

    const totalPaid = (allPayments || []).reduce((s: number, p: { amount: number }) => s + p.amount, 0)

    const { data: invoice } = await supabase
      .from('finance_invoices')
      .select('total, status')
      .eq('id', body.invoice_id)
      .single()

    if (invoice) {
      const newStatus = totalPaid >= invoice.total ? 'paid' : totalPaid > 0 ? 'partial' : invoice.status
      await supabase
        .from('finance_invoices')
        .update({ amount_paid: totalPaid, status: newStatus })
        .eq('id', body.invoice_id)
    }
  }

  return NextResponse.json({ payment }, { status: 201 })
}
