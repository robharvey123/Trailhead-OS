import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { fetchWiseRate, FxError } from '@/lib/fx/wise'
import { isSupportedCurrency } from '@/lib/money'

// GET /api/fx/rate?from=GBP&to=USD → { rate, date, source } (Wise mid-market).
// The rate is the quoted pair (1 GBP = rate target), ready for fx_rate_quote.
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const from = (request.nextUrl.searchParams.get('from') || 'GBP').toUpperCase()
  const to = (request.nextUrl.searchParams.get('to') || '').toUpperCase()
  if (from !== 'GBP') return NextResponse.json({ error: 'from must be GBP' }, { status: 400 })
  if (!isSupportedCurrency(to) || to === 'GBP') {
    return NextResponse.json({ error: 'Unsupported target currency' }, { status: 400 })
  }

  try {
    const rate = await fetchWiseRate(from, to)
    return NextResponse.json(rate)
  } catch (e) {
    const status = e instanceof FxError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Rate lookup failed' }, { status })
  }
}
