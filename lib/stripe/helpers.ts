import { supabaseService } from '@/lib/supabase/service'
import { getStripe } from './client'

export async function getOrCreateStripeCustomer(
  accountId: string,
  accountName: string,
  contactEmail?: string
): Promise<string> {
  const stripe = getStripe()
  const { data: existing } = await supabaseService
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('account_id', accountId)
    .maybeSingle<{ stripe_customer_id: string }>()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    name: accountName,
    email: contactEmail,
    metadata: { account_id: accountId },
  })

  await supabaseService.from('stripe_customers').insert({
    account_id: accountId,
    stripe_customer_id: customer.id,
  })

  return customer.id
}

export async function createPaymentLink(
  invoiceId: string,
  invoiceNumber: string,
  amountPence: number,
  customerEmail?: string,
  stripeCustomerId?: string
): Promise<string> {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    customer_email: stripeCustomerId ? undefined : customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `Invoice ${invoiceNumber}`,
            description: 'Trailhead Holdings Ltd',
          },
          unit_amount: amountPence,
        },
        quantity: 1,
      },
    ],
    metadata: { invoice_id: invoiceId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoicing/${invoiceId}?paid=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoicing/${invoiceId}`,
  })

  await supabaseService
    .from('invoices')
    .update({
      stripe_session_id: session.id,
      stripe_payment_link: session.url,
    })
    .eq('id', invoiceId)

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  return session.url
}

export async function createSubscription(
  stripeCustomerId: string,
  amountPence: number,
  interval: 'month' | 'year',
  description: string,
  invoiceId: string
): Promise<string> {
  const stripe = getStripe()
  const price = await stripe.prices.create({
    currency: 'gbp',
    unit_amount: amountPence,
    recurring: { interval },
    product_data: { name: description },
  })

  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: price.id }],
    metadata: { invoice_id: invoiceId },
    payment_behavior: 'default_incomplete',
    payment_settings: {
      payment_method_types: ['card'],
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
  })

  return subscription.id
}
