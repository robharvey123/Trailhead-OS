import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createSubscription, getOrCreateStripeCustomer } from '@/lib/stripe/helpers'
import { calculateTotals } from '@/lib/types'

type InvoiceWithRelations = {
  id: string
  invoice_number: string
  account_id: string | null
  contact_id: string | null
  line_items: Array<{ id: string; description: string; qty: number; unit_price: number }>
  vat_rate: number
  accounts: { id: string; name: string } | null
  contacts: { id: string; email: string | null } | null
}

function isInterval(value: unknown): value is 'month' | 'year' {
  return value === 'month' || value === 'year'
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : ''
  const interval = body.interval

  if (!invoiceId || !isInterval(interval)) {
    return NextResponse.json(
      { error: "invoice_id and interval ('month' or 'year') are required" },
      { status: 400 }
    )
  }

  try {
    const { data: invoice, error } = await auth.supabase
      .from('invoices')
      .select('id, invoice_number, account_id, contact_id, line_items, vat_rate, accounts(id, name), contacts(id, email)')
      .eq('id', invoiceId)
      .maybeSingle<InvoiceWithRelations>()

    if (error) {
      throw new Error(error.message)
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (!invoice.account_id || !invoice.accounts?.name) {
      return NextResponse.json(
        { error: 'Recurring subscriptions require the invoice to be linked to an account' },
        { status: 400 }
      )
    }

    const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
    const amountPence = Math.round(totals.total * 100)
    const stripeCustomerId = await getOrCreateStripeCustomer(
      invoice.account_id,
      invoice.accounts.name,
      invoice.contacts?.email ?? undefined
    )

    const subscriptionId = await createSubscription(
      stripeCustomerId,
      amountPence,
      interval,
      `Invoice ${invoice.invoice_number}`,
      invoice.id
    )

    const [{ error: invoiceUpdateError }, { error: customerUpdateError }] = await Promise.all([
      auth.supabase
        .from('invoices')
        .update({
          is_recurring: true,
          recurring_interval: interval,
          stripe_subscription_id: subscriptionId,
        })
        .eq('id', invoice.id),
      auth.supabase
        .from('stripe_customers')
        .update({
          contact_id: invoice.contact_id,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'incomplete',
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', invoice.account_id),
    ])

    if (invoiceUpdateError || customerUpdateError) {
      throw new Error(
        invoiceUpdateError?.message ||
          customerUpdateError?.message ||
          'Failed to save Stripe subscription state'
      )
    }

    return NextResponse.json({ subscription_id: subscriptionId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Stripe subscription' },
      { status: 500 }
    )
  }
}
