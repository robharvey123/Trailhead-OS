// The invoice payments ledger — the ONLY place payment state is computed.
// invoices.paid_at is a derived mirror of the settling payment date (the
// engagement views select it); invoices.status paid/part_paid is derived from
// the ledger. Nothing else may write either.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { calculateTotals, roundMoney, type Invoice, type InvoicePayment, type InvoicePaymentState, type InvoiceStatus } from '@/lib/types'

// Accepts the SSR session client (RLS) or the admin/service client (webhook, Cowork).
async function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ?? ((await createClient()) as unknown as SupabaseClient)
}

export interface InvoicePaymentInput {
  invoice_id: string
  paid_on: string
  amount: number
  currency?: string
  method?: InvoicePayment['method']
  reference?: string | null
  notes?: string | null
  stripe_payment_intent_id?: string | null
}

export async function listPayments(invoiceId: string, client?: SupabaseClient): Promise<InvoicePayment[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_on', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load payments')
  return ((data ?? []) as InvoicePayment[]).map((p) => ({ ...p, amount: Number(p.amount) }))
}

export async function createPayment(input: InvoicePaymentInput, client?: SupabaseClient): Promise<InvoicePayment> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: input.invoice_id,
      paid_on: input.paid_on,
      amount: roundMoney(input.amount),
      currency: input.currency ?? 'GBP',
      method: input.method ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to record payment')
  await recalcInvoicePaymentState(input.invoice_id, supabase)
  return { ...(data as InvoicePayment), amount: Number((data as InvoicePayment).amount) }
}

export async function updatePayment(
  id: string,
  patch: Partial<Pick<InvoicePayment, 'paid_on' | 'amount' | 'method' | 'reference' | 'notes'>>,
  client?: SupabaseClient
): Promise<InvoicePayment> {
  const supabase = await getSupabase(client)
  const clean: Record<string, unknown> = { ...patch }
  if (clean.amount !== undefined) clean.amount = roundMoney(Number(clean.amount))
  const { data, error } = await supabase.from('invoice_payments').update(clean).eq('id', id).select('*').single()
  if (error) throw new Error(error.message || 'Failed to update payment')
  const payment = { ...(data as InvoicePayment), amount: Number((data as InvoicePayment).amount) }
  await recalcInvoicePaymentState(payment.invoice_id, supabase)
  return payment
}

export async function deletePayment(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('invoice_payments').delete().eq('id', id).select('invoice_id').single()
  if (error) throw new Error(error.message || 'Failed to delete payment')
  await recalcInvoicePaymentState((data as { invoice_id: string }).invoice_id, supabase)
}

export function invoiceTotal(invoice: Pick<Invoice, 'line_items' | 'vat_rate'>): number {
  return roundMoney(calculateTotals(invoice.line_items, invoice.vat_rate).total)
}

/**
 * Re-derive an invoice's payment state from the ledger:
 * - settled (balance <= 0.005) → paid, paid_at = max paid_on at midday UTC so
 *   timezone drift can never shift the date
 * - some payment → part_paid, paid_at null
 * - none → overdue when past due, else sent; paid_at null
 * Draft and cancelled invoices are never touched.
 */
export async function recalcInvoicePaymentState(invoiceId: string, client?: SupabaseClient): Promise<InvoicePaymentState> {
  const supabase = await getSupabase(client)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, status, due_date, line_items, vat_rate, paid_at')
    .eq('id', invoiceId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load invoice')
  if (!invoice) throw new Error('Invoice not found')

  const payments = await listPayments(invoiceId, supabase)
  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
  const total = invoiceTotal(invoice as Pick<Invoice, 'line_items' | 'vat_rate'>)
  const balance = roundMoney(total - amountPaid)

  const current = (invoice as { status: InvoiceStatus }).status
  if (current === 'draft' || current === 'cancelled') {
    return { status: current, paid_at: (invoice as { paid_at: string | null }).paid_at ?? null, amount_paid: amountPaid, balance }
  }

  let status: InvoiceStatus
  let paidAt: string | null
  if (balance <= 0.005 && total > 0) {
    status = 'paid'
    const lastPaidOn = payments.reduce((max, p) => (p.paid_on > max ? p.paid_on : max), payments[0]?.paid_on ?? new Date().toISOString().slice(0, 10))
    paidAt = `${lastPaidOn}T12:00:00.000Z`
  } else if (amountPaid > 0) {
    status = 'part_paid'
    paidAt = null
  } else {
    const today = new Date().toISOString().slice(0, 10)
    const due = (invoice as { due_date: string | null }).due_date
    status = due && due < today ? 'overdue' : 'sent'
    paidAt = null
  }

  const { error: upErr } = await supabase.from('invoices').update({ status, paid_at: paidAt }).eq('id', invoiceId)
  if (upErr) throw new Error(upErr.message || 'Failed to update invoice payment state')
  return { status, paid_at: paidAt, amount_paid: amountPaid, balance }
}
