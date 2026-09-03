import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getInvoiceById } from '@/lib/db/invoices'
import { deletePayment, invoiceTotal, listPayments, updatePayment } from '@/lib/db/invoice-payments'
import { roundMoney, type InvoicePaymentMethod } from '@/lib/types'

const METHODS = new Set<InvoicePaymentMethod>(['bank_transfer', 'stripe', 'card', 'cash', 'cheque', 'other'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id, paymentId } = await params
    const invoice = await getInvoiceById(id, supabase)
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const payments = await listPayments(id, supabase)
    const existing = payments.find((p) => p.id === paymentId)
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const patch: Parameters<typeof updatePayment>[1] = {}
    if (body.paid_on !== undefined) {
      if (typeof body.paid_on !== 'string' || !DATE_RE.test(body.paid_on)) {
        return NextResponse.json({ error: 'paid_on must be a YYYY-MM-DD date' }, { status: 400 })
      }
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      if (body.paid_on > tomorrow) return NextResponse.json({ error: 'paid_on cannot be more than one day in the future' }, { status: 400 })
      patch.paid_on = body.paid_on
    }
    if (body.amount !== undefined) {
      const amount = roundMoney(Number(body.amount))
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'amount must be greater than zero' }, { status: 400 })
      const othersTotal = payments.filter((p) => p.id !== paymentId).reduce((sum, p) => sum + p.amount, 0)
      const total = invoiceTotal(invoice)
      if (roundMoney(othersTotal + amount) > total + 0.01) {
        return NextResponse.json({ error: `Payment exceeds the outstanding balance of ${roundMoney(total - othersTotal).toFixed(2)}` }, { status: 400 })
      }
      patch.amount = amount
    }
    if (body.method !== undefined) {
      patch.method = typeof body.method === 'string' && METHODS.has(body.method as InvoicePaymentMethod) ? (body.method as InvoicePaymentMethod) : null
    }
    if (body.reference !== undefined) patch.reference = typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null
    if (body.notes !== undefined) patch.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })

    const payment = await updatePayment(paymentId, patch, supabase)
    return NextResponse.json({ payment })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { paymentId } = await params
    await deletePayment(paymentId, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete payment' }, { status: 500 })
  }
}
