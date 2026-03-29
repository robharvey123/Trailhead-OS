import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getStripe } from '@/lib/stripe/client'

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const stripe = getStripe()
    const balance = await stripe.balance.retrieve()
    const currency =
      balance.available?.[0]?.currency ??
      balance.pending?.[0]?.currency ??
      'gbp'

    return NextResponse.json({ connected: true, currency })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
