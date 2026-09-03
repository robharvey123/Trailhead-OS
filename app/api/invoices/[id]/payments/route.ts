import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getInvoiceById } from '@/lib/db/invoices'
import { createPayment, invoiceTotal, listPayments } from '@/lib/db/invoice-payments'
import { roundMoney, type InvoicePaymentMethod } from '@/lib/types'

const METHODS = new Set<InvoicePaymentMethod>(['bank_transfer', 'stripe', 'card', 'cash', 'cheque', 'other'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const invoice = await getInvoiceById(id, supabase)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const payments = await listPayments(id, supabase)
    const total = invoiceTotal(invoice)
    const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
    return NextResponse.json({ payments, total, amount_paid: amountPaid, balance: roundMoney(total - amountPaid) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load payments' }, { status: 500 })
  }
}

// POST — record a payment. The date is freely editable (a payment three weeks
// ago is normal); only the future is rejected. Overpaying beyond a rounding
// penny is a 400 naming the balance, never a silent overpay.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const invoice = await getInvoiceById(id, supabase)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      return NextResponse.json({ error: `Cannot record a payment against a ${invoice.status} invoice` }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const paidOn = typeof body.paid_on === 'string' && DATE_RE.test(body.paid_on) ? body.paid_on : null
    if (!paidOn) return NextResponse.json({ error: 'paid_on must be a YYYY-MM-DD date' }, { status: 400 })
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    if (paidOn > tomorrow) return NextResponse.json({ error: 'paid_on cannot be more than one day in the future' }, { status: 400 })

    const amount = roundMoney(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount must be greater than zero' }, { status: 400 })

    const payments = await listPayments(id, supabase)
    const total = invoiceTotal(invoice)
    const balance = roundMoney(total - payments.reduce((sum, p) => sum + p.amount, 0))
    if (amount > balance + 0.01) {
      return NextResponse.json({ error: `Payment exceeds the outstanding balance of ${balance.toFixed(2)}` }, { status: 400 })
    }

    const method = typeof body.method === 'string' && METHODS.has(body.method as InvoicePaymentMethod) ? (body.method as InvoicePaymentMethod) : null
    const payment = await createPayment(
      {
        invoice_id: id,
        paid_on: paidOn,
        amount,
        currency: invoice.currency ?? 'GBP',
        method,
        reference: typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
      },
      supabase
    )
    return NextResponse.json({ payment }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to record payment' }, { status: 500 })
  }
}
