import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: 'Missing webhook configuration' }, { status: 400 })
  }

  // Verify Stripe signature
  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    // Use Stripe SDK if available, otherwise manual HMAC verification
    const stripe = await import('stripe').then(m => new m.default(process.env.STRIPE_SECRET_KEY || ''))
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as unknown as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the workspace + stream that has Stripe connected
  // Look for income_streams of type 'saas' with Stripe config
  const { data: streams } = await admin
    .from('income_streams')
    .select('id, workspace_id')
    .eq('type', 'saas')
    .limit(10)

  if (!streams?.length) {
    return NextResponse.json({ received: true, processed: false })
  }

  const obj = event.data.object

  if (event.type === 'payment_intent.succeeded' || event.type === 'charge.succeeded') {
    const paymentId = (obj.id as string) || ''
    const amount = ((obj.amount as number) || 0) / 100 // Stripe amounts in smallest unit
    const currency = (obj.currency as string) || 'gbp'
    const customerEmail = (obj.receipt_email as string) || (obj.billing_details as Record<string, unknown>)?.email as string || null
    const customerId = (obj.customer as string) || null
    const description = (obj.description as string) || null
    const metadata = (obj.metadata as Record<string, unknown>) || {}

    // Use the first SaaS stream found (single-tenant for Trailhead)
    const stream = streams[0]

    await admin.from('stripe_payments').upsert({
      workspace_id: stream.workspace_id,
      stream_id: stream.id,
      stripe_payment_id: paymentId,
      stripe_customer_id: customerId,
      customer_email: customerEmail,
      customer_name: (obj.billing_details as Record<string, unknown>)?.name as string || null,
      amount,
      currency,
      status: 'succeeded',
      payment_date: new Date().toISOString(),
      description,
      metadata,
    }, { onConflict: 'stripe_payment_id' })
  }

  if (event.type === 'charge.refunded') {
    const paymentId = (obj.payment_intent as string) || (obj.id as string)
    await admin.from('stripe_payments')
      .update({ status: 'refunded' })
      .eq('stripe_payment_id', paymentId)
  }

  if (event.type === 'invoice.paid') {
    const paymentIntent = (obj.payment_intent as string) || ''
    const amount = ((obj.amount_paid as number) || 0) / 100
    const currency = (obj.currency as string) || 'gbp'
    const customerEmail = (obj.customer_email as string) || null
    const customerName = (obj.customer_name as string) || null
    const customerId = (obj.customer as string) || null
    const subscriptionId = (obj.subscription as string) || null
    const stream = streams[0]

    await admin.from('stripe_payments').upsert({
      workspace_id: stream.workspace_id,
      stream_id: stream.id,
      stripe_payment_id: paymentIntent || `inv_${obj.id}`,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      customer_email: customerEmail,
      customer_name: customerName,
      amount,
      currency,
      status: 'succeeded',
      payment_date: new Date().toISOString(),
      description: `Invoice ${obj.number || obj.id}`,
      metadata: {},
    }, { onConflict: 'stripe_payment_id' })
  }

  return NextResponse.json({ received: true })
}
