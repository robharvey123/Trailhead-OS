import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getPricingTiers } from '@/lib/db/pricing-tiers'

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const pricingTiers = await getPricingTiers(auth.supabase)
    return NextResponse.json({ pricing_tiers: pricingTiers })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pricing tiers' },
      { status: 500 }
    )
  }
}
