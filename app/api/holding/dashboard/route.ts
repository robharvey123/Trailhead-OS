import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  // Parallel queries
  const [
    { data: stripePayments },
    { data: invoices },
    { data: expenses },
    { data: bankTxs },
    { data: streams },
  ] = await Promise.all([
    supabase.from('stripe_payments').select('amount, status, payment_date, stream_id').eq('workspace_id', workspaceId).eq('status', 'succeeded'),
    supabase.from('finance_invoices').select('total, amount_paid, status, direction, stream_id, issue_date').eq('workspace_id', workspaceId),
    supabase.from('holding_expenses').select('amount, expense_date, stream_id, category').eq('workspace_id', workspaceId),
    supabase.from('bank_transactions').select('amount, date, reconciled, balance_after').eq('workspace_id', workspaceId).order('date', { ascending: false }),
    supabase.from('income_streams').select('id, name, type').eq('workspace_id', workspaceId).eq('is_active', true),
  ])

  // === Money In ===
  const stripeRevenue = (stripePayments || []).reduce((s, p) => s + Number(p.amount), 0)
  const paidInvoices = (invoices || []).filter(i => i.direction === 'outgoing' && ['paid', 'partial'].includes(i.status))
  const invoiceRevenue = paidInvoices.reduce((s, i) => s + Number(i.amount_paid), 0)
  const totalRevenue = stripeRevenue + invoiceRevenue

  // === Money Out ===
  const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount), 0)

  // === Outstanding ===
  const outstandingInvoices = (invoices || [])
    .filter(i => i.direction === 'outgoing' && ['sent', 'viewed', 'partial', 'overdue'].includes(i.status))
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0)

  // === Bank ===
  const latestBalance = (bankTxs || []).length > 0 ? Number((bankTxs || [])[0].balance_after) : null
  const unreconciledCount = (bankTxs || []).filter(t => !t.reconciled).length

  // === By Stream ===
  const streamMap = new Map((streams || []).map(s => [s.id, s]))
  const byStreamRevenue = new Map<string, number>()

  for (const p of stripePayments || []) {
    if (p.stream_id) byStreamRevenue.set(p.stream_id, (byStreamRevenue.get(p.stream_id) ?? 0) + Number(p.amount))
  }
  for (const i of paidInvoices) {
    if (i.stream_id) byStreamRevenue.set(i.stream_id, (byStreamRevenue.get(i.stream_id) ?? 0) + Number(i.amount_paid))
  }

  const byStream = [...byStreamRevenue.entries()].map(([streamId, revenue]) => {
    const stream = streamMap.get(streamId)
    return {
      stream_id: streamId,
      stream_name: stream?.name ?? 'Unknown',
      stream_type: stream?.type ?? 'other',
      revenue,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  // === Monthly ===
  const monthlyMap = new Map<string, { money_in: number; money_out: number }>()

  for (const p of stripePayments || []) {
    const month = (p.payment_date as string).slice(0, 7)
    const entry = monthlyMap.get(month) ?? { money_in: 0, money_out: 0 }
    entry.money_in += Number(p.amount)
    monthlyMap.set(month, entry)
  }
  for (const i of paidInvoices) {
    const month = (i.issue_date as string).slice(0, 7)
    const entry = monthlyMap.get(month) ?? { money_in: 0, money_out: 0 }
    entry.money_in += Number(i.amount_paid)
    monthlyMap.set(month, entry)
  }
  for (const e of expenses || []) {
    const month = (e.expense_date as string).slice(0, 7)
    const entry = monthlyMap.get(month) ?? { money_in: 0, money_out: 0 }
    entry.money_out += Number(e.amount)
    monthlyMap.set(month, entry)
  }

  const monthly = [...monthlyMap.entries()]
    .map(([month, data]) => ({ month, money_in: data.money_in, money_out: data.money_out, net: data.money_in - data.money_out }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return NextResponse.json({
    summary: {
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      bank_balance: latestBalance,
      outstanding_invoices: outstandingInvoices,
      unreconciled_count: unreconciledCount,
      by_stream: byStream,
      monthly,
    },
  })
}
