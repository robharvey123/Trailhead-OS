import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get all workstreams
    const { data: workstreams, error: wsError } = await supabase
      .from('workstreams')
      .select('id, slug, label, colour')
      .order('sort_order')

    if (wsError) throw new Error(wsError.message)

    // Get totals from invoices (only paid ones count as revenue)
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('workstream_id, line_items, vat_rate, status')
      .eq('status', 'paid')

    if (invError) throw new Error(invError.message)

    // Get all expenses
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('workstream_id, amount')

    if (expError) throw new Error(expError.message)

    // Calculate revenue per workstream
    const revenueByWorkstream = new Map<string, number>()
    for (const inv of invoices ?? []) {
      if (!inv.workstream_id) continue
      const items = (inv.line_items ?? []) as { qty: number; unit_price: number }[]
      const subtotal = items.reduce((sum, item) => {
        const qty = Number.isFinite(item.qty) ? item.qty : 0
        const price = Number.isFinite(item.unit_price) ? item.unit_price : 0
        return sum + qty * price
      }, 0)
      revenueByWorkstream.set(
        inv.workstream_id,
        (revenueByWorkstream.get(inv.workstream_id) ?? 0) + subtotal
      )
    }

    // Calculate expenses per workstream
    const expensesByWorkstream = new Map<string, number>()
    for (const exp of expenses ?? []) {
      if (!exp.workstream_id) continue
      expensesByWorkstream.set(
        exp.workstream_id,
        (expensesByWorkstream.get(exp.workstream_id) ?? 0) + Number(exp.amount)
      )
    }

    // Unassigned totals
    const unassignedRevenue = (invoices ?? [])
      .filter((inv) => !inv.workstream_id)
      .reduce((sum, inv) => {
        const items = (inv.line_items ?? []) as { qty: number; unit_price: number }[]
        return sum + items.reduce((s, item) => {
          const qty = Number.isFinite(item.qty) ? item.qty : 0
          const price = Number.isFinite(item.unit_price) ? item.unit_price : 0
          return s + qty * price
        }, 0)
      }, 0)

    const unassignedExpenses = (expenses ?? [])
      .filter((exp) => !exp.workstream_id)
      .reduce((sum, exp) => sum + Number(exp.amount), 0)

    const rows = (workstreams ?? []).map((ws) => {
      const revenue = revenueByWorkstream.get(ws.id) ?? 0
      const totalExpenses = expensesByWorkstream.get(ws.id) ?? 0
      return {
        workstream_id: ws.id,
        slug: ws.slug,
        label: ws.label,
        colour: ws.colour,
        revenue,
        expenses: totalExpenses,
        net: revenue - totalExpenses,
      }
    })

    if (unassignedRevenue > 0 || unassignedExpenses > 0) {
      rows.push({
        workstream_id: '',
        slug: '',
        label: 'Unassigned',
        colour: 'slate',
        revenue: unassignedRevenue,
        expenses: unassignedExpenses,
        net: unassignedRevenue - unassignedExpenses,
      })
    }

    const totals = rows.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        expenses: acc.expenses + row.expenses,
        net: acc.net + row.net,
      }),
      { revenue: 0, expenses: 0, net: 0 }
    )

    return NextResponse.json({ rows, totals })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load P&L' },
      { status: 500 }
    )
  }
}
