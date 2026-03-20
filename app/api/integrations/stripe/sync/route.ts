import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  // Get Stripe API key from workspace integrations
  const { data: integration } = await supabase
    .from('workspace_integrations')
    .select('credentials')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'stripe')
    .eq('status', 'connected')
    .maybeSingle()

  const apiKey = (integration?.credentials as Record<string, string>)?.api_key || process.env.STRIPE_SECRET_KEY
  if (!apiKey) return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 })

  // Get the SaaS stream for this workspace
  const { data: stream } = await supabase
    .from('income_streams')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('type', 'saas')
    .maybeSingle()

  const streamId = body.stream_id || stream?.id || null

  // Fetch recent charges from Stripe
  const stripe = await import('stripe').then(m => new m.default(apiKey))
  const charges = await stripe.charges.list({
    limit: 100,
    created: {
      gte: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // last 30 days
    },
  })

  let synced = 0
  let skipped = 0

  for (const charge of charges.data) {
    if (charge.status !== 'succeeded') continue

    const { error } = await supabase.from('stripe_payments').upsert({
      workspace_id: workspaceId,
      stream_id: streamId,
      stripe_payment_id: charge.payment_intent as string || charge.id,
      stripe_customer_id: charge.customer as string || null,
      customer_email: charge.receipt_email || charge.billing_details?.email || null,
      customer_name: charge.billing_details?.name || null,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: charge.refunded ? 'refunded' : 'succeeded',
      payment_date: new Date(charge.created * 1000).toISOString(),
      description: charge.description || null,
      metadata: charge.metadata || {},
    }, { onConflict: 'stripe_payment_id' })

    if (error) skipped++
    else synced++
  }

  return NextResponse.json({ synced, skipped, total: charges.data.length })
}
