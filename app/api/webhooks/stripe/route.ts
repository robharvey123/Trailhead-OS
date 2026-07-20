import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvoicePaidNotification } from '@/lib/stripe/notifications'
import { getStripe } from '@/lib/stripe/client'

async function markInvoicePaidById(invoiceId: string, paymentIntentId?: string | null) {
  const admin = createAdminClient()
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('id', invoiceId)
    .maybeSingle<{ id: string; invoice_number: string; status: string }>()

  // A query failure is transient — throw so the caller returns 500 and Stripe
  // retries. A genuinely missing invoice is not retryable, so return quietly.
  if (error) {
    throw new Error(`Failed to look up invoice ${invoiceId}: ${error.message}`)
  }
  if (!invoice) {
    return
  }

  if (invoice.status !== 'paid') {
    const { error: updateError } = await admin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId ?? undefined,
      })
      .eq('id', invoice.id)

    if (updateError) {
      throw new Error(`Failed to mark invoice ${invoice.id} paid: ${updateError.message}`)
    }

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
        await markInvoicePaidById(
          invoiceId,
          typeof session.payment_intent === 'string' ? session.payment_intent : null
        )
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const { data: invoice } = await admin
        .from('invoices')
        .select('id, status')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle<{ id: string; status: string }>()

      if (invoice && invoice.status !== 'paid') {
        await markInvoicePaidById(invoice.id, paymentIntent.id)
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
        await markInvoicePaidById(
          osInvoiceId,
          typeof stripeInvoice.payment_intent === 'string' ? stripeInvoice.payment_intent : null
        )
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
