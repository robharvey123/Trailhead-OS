import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvoicePaidNotification } from '@/lib/stripe/notifications'
import { getStripe } from '@/lib/stripe/client'
import { invoiceTotal, listPayments, recalcInvoicePaymentState } from '@/lib/db/invoice-payments'
import { roundMoney, type Invoice } from '@/lib/types'

/**
 * Record a Stripe payment in the ledger and re-derive the invoice's state.
 * `idempotencyKey` lands in invoice_payments.stripe_payment_intent_id, whose
 * unique index makes webhook replays create exactly one row.
 */
async function recordStripePayment(
  invoiceId: string,
  opts: { paymentIntentId?: string | null; idempotencyKey: string; amountMinor?: number | null; occurredAtUnix?: number | null }
) {
  const admin = createAdminClient()
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('id, invoice_number, status, currency, line_items, vat_rate')
    .eq('id', invoiceId)
    .maybeSingle<Pick<Invoice, 'id' | 'invoice_number' | 'status' | 'currency' | 'line_items' | 'vat_rate'>>()

  // A query failure is transient — throw so the caller returns 500 and Stripe
  // retries. A genuinely missing invoice is not retryable, so return quietly.
  if (error) {
    throw new Error(`Failed to look up invoice ${invoiceId}: ${error.message}`)
  }
  if (!invoice) {
    return
  }

  if (opts.paymentIntentId) {
    await admin.from('invoices').update({ stripe_payment_intent_id: opts.paymentIntentId }).eq('id', invoice.id)
  }

  // Amount from the event where present; otherwise the outstanding balance.
  let amount = opts.amountMinor != null && Number.isFinite(opts.amountMinor) ? roundMoney(opts.amountMinor / 100) : null
  if (amount === null || amount <= 0) {
    const payments = await listPayments(invoice.id, admin)
    amount = roundMoney(invoiceTotal(invoice) - payments.reduce((sum, p) => sum + p.amount, 0))
  }
  if (amount <= 0) {
    await recalcInvoicePaymentState(invoice.id, admin)
    return
  }

  const paidOn = new Date((opts.occurredAtUnix ?? Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10)
  const wasPaid = invoice.status === 'paid'
  const { error: insertError } = await admin.from('invoice_payments').insert({
    invoice_id: invoice.id,
    paid_on: paidOn,
    amount,
    currency: invoice.currency ?? 'GBP',
    method: 'stripe',
    reference: opts.paymentIntentId ?? opts.idempotencyKey,
    stripe_payment_intent_id: opts.idempotencyKey,
  })
  if (insertError) {
    // 23505 = the unique index caught a replay of the same payment. Idempotent, done.
    if (insertError.code === '23505') return
    throw new Error(`Failed to record Stripe payment for ${invoice.id}: ${insertError.message}`)
  }

  const state = await recalcInvoicePaymentState(invoice.id, admin)
  if (!wasPaid && state.status === 'paid') {
    await sendInvoicePaidNotification(invoice.id, invoice.invoice_number)
  }
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')
  const body = await request.text()

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing Stripe webhook configuration' }, { status: 400 })
  }

  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()
  const notes: string[] = []

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const invoiceId = session.metadata?.invoice_id

      if (invoiceId) {
        const pi = typeof session.payment_intent === 'string' ? session.payment_intent : null
        await recordStripePayment(invoiceId, {
          paymentIntentId: pi,
          idempotencyKey: pi ?? `cs:${session.id}`,
          amountMinor: typeof session.amount_total === 'number' ? session.amount_total : null,
          occurredAtUnix: event.created,
        })
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const { data: invoice } = await admin
        .from('invoices')
        .select('id, status')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle<{ id: string; status: string }>()

      if (invoice) {
        await recordStripePayment(invoice.id, {
          paymentIntentId: paymentIntent.id,
          idempotencyKey: paymentIntent.id,
          amountMinor: typeof paymentIntent.amount_received === 'number' ? paymentIntent.amount_received : null,
          occurredAtUnix: event.created,
        })
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      // Recurring subscription payment. The OS invoice id lives in the
      // subscription's metadata (set in createSubscription), not on the Stripe
      // invoice, so fetch the subscription to read it when it isn't inlined.
      const stripeInvoice = event.data.object as {
        id: string
        subscription?: string | { id: string; metadata?: Record<string, string> } | null
        subscription_details?: { metadata?: Record<string, string> } | null
        payment_intent?: string | { id: string } | null
      }

      const subId =
        typeof stripeInvoice.subscription === 'string'
          ? stripeInvoice.subscription
          : stripeInvoice.subscription?.id ?? null

      let osInvoiceId = stripeInvoice.subscription_details?.metadata?.invoice_id ?? null
      if (!osInvoiceId && subId) {
        const subscription = await stripe.subscriptions.retrieve(subId)
        osInvoiceId = subscription.metadata?.invoice_id ?? null
      }

      if (osInvoiceId) {
        const pi = typeof stripeInvoice.payment_intent === 'string' ? stripeInvoice.payment_intent : null
        const amountPaid = (stripeInvoice as { amount_paid?: number }).amount_paid
        await recordStripePayment(osInvoiceId, {
          paymentIntentId: pi,
          idempotencyKey: pi ?? `in:${stripeInvoice.id}`,
          amountMinor: typeof amountPaid === 'number' ? amountPaid : null,
          occurredAtUnix: event.created,
        })
      } else {
        // Don't silently drop it — surface the unmatched payment for review.
        const note = `Unmatched subscription payment: stripe_invoice=${stripeInvoice.id}, subscription=${subId ?? 'none'}`
        console.warn(note)
        notes.push(note)
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object
      await admin
        .from('stripe_customers')
        .update({
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', String(subscription.customer))
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      await admin
        .from('stripe_customers')
        .update({
          subscription_status: 'cancelled',
          stripe_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', String(subscription.customer))
    }

    return NextResponse.json({ received: true, notes: notes.length ? notes : undefined })
  } catch (err) {
    // Surface the failure so Stripe retries rather than silently dropping it.
    console.error('Stripe webhook handler failed:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
