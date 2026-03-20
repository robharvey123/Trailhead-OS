import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

// POST: Match a bank transaction to an invoice, expense, or stripe payment
export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const transactionId = body.transaction_id
  const matchType = body.match_type // 'invoice' | 'expense' | 'stripe'
  const matchId = body.match_id

  if (!transactionId || !matchType || !matchId) {
    return NextResponse.json({ error: 'transaction_id, match_type, and match_id are required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { reconciled: true }

  if (matchType === 'invoice') {
    updates.matched_invoice_id = matchId
  } else if (matchType === 'expense') {
    updates.matched_expense_id = matchId
  } else if (matchType === 'stripe') {
    updates.matched_stripe_id = matchId
  } else {
    return NextResponse.json({ error: 'Invalid match_type' }, { status: 400 })
  }

  const { data: tx, error } = await supabase
    .from('bank_transactions')
    .update(updates)
    .eq('id', transactionId)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If matching to invoice, update invoice amount_paid
  if (matchType === 'invoice' && tx) {
    const amount = Math.abs(tx.amount as number)
    const { data: invoice } = await supabase
      .from('finance_invoices')
      .select('amount_paid, total')
      .eq('id', matchId)
      .eq('workspace_id', workspaceId)
      .single()

    if (invoice) {
      const newPaid = (invoice.amount_paid || 0) + amount
      const newStatus = newPaid >= invoice.total ? 'paid' : 'partial'
      await supabase
        .from('finance_invoices')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', matchId)
        .eq('workspace_id', workspaceId)
    }
  }

  return NextResponse.json({ transaction: tx })
}

// DELETE: Unmatch a bank transaction
export async function DELETE(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const transactionId = request.nextUrl.searchParams.get('transaction_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase
    .from('bank_transactions')
    .update({
      matched_invoice_id: null,
      matched_expense_id: null,
      matched_stripe_id: null,
      reconciled: false,
    })
    .eq('id', transactionId)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// GET: Suggested matches for unreconciled transactions
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const transactionId = request.nextUrl.searchParams.get('transaction_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  // Get the transaction
  const { data: tx } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const amount = Math.abs(tx.amount as number)
  const tolerance = amount * 0.02 // 2% tolerance for matching
  const suggestions: { type: string; id: string; label: string; amount: number; date: string; confidence: string }[] = []

  if (tx.amount > 0) {
    // Money in — match against outgoing invoices (payments received)
    const { data: invoices } = await supabase
      .from('finance_invoices')
      .select('id, invoice_number, total, amount_paid, account_id, issue_date')
      .eq('workspace_id', workspaceId)
      .eq('direction', 'outgoing')
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .gte('total', amount - tolerance)
      .lte('total', amount + tolerance)

    for (const inv of invoices || []) {
      const remaining = inv.total - (inv.amount_paid || 0)
      const diff = Math.abs(remaining - amount)
      suggestions.push({
        type: 'invoice',
        id: inv.id,
        label: `Invoice ${inv.invoice_number}`,
        amount: inv.total,
        date: inv.issue_date,
        confidence: diff < 0.01 ? 'high' : diff < tolerance ? 'medium' : 'low',
      })
    }

    // Also check Stripe payments
    const { data: stripePayments } = await supabase
      .from('stripe_payments')
      .select('id, stripe_payment_id, amount, payment_date, customer_name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'succeeded')
      .gte('amount', amount - tolerance)
      .lte('amount', amount + tolerance)

    for (const sp of stripePayments || []) {
      const diff = Math.abs(sp.amount - amount)
      suggestions.push({
        type: 'stripe',
        id: sp.id,
        label: `Stripe ${sp.customer_name || sp.stripe_payment_id}`,
        amount: sp.amount,
        date: sp.payment_date,
        confidence: diff < 0.01 ? 'high' : 'medium',
      })
    }
  } else {
    // Money out — match against expenses
    const { data: expenses } = await supabase
      .from('holding_expenses')
      .select('id, description, amount, expense_date, vendor')
      .eq('workspace_id', workspaceId)
      .gte('amount', amount - tolerance)
      .lte('amount', amount + tolerance)

    for (const exp of expenses || []) {
      const diff = Math.abs(exp.amount - amount)
      suggestions.push({
        type: 'expense',
        id: exp.id,
        label: exp.vendor || exp.description,
        amount: exp.amount,
        date: exp.expense_date,
        confidence: diff < 0.01 ? 'high' : 'medium',
      })
    }
  }

  // Sort by confidence
  const order = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => order[a.confidence as keyof typeof order] - order[b.confidence as keyof typeof order])

  return NextResponse.json({ suggestions })
}
