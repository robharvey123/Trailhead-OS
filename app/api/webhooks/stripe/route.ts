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

  if (error || !invoice) {
    return
  }

  if (invoice.status !== 'paid') {
    await admin
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId ?? undefined,
      })
      .eq('id', invoice.id)

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

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ received: true })
  }
}
