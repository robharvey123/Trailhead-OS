import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createRemittanceAccount, listRemittanceAccounts } from '@/lib/db/remittance-accounts'
import { REMITTANCE_CURRENCIES, REMITTANCE_RAILS, validateRemittanceAccount } from '@/lib/remittance'
import type { RemittanceRail } from '@/lib/types'

export async function GET() {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    return NextResponse.json({ accounts: await listRemittanceAccounts(supabase) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : ''
    if (!(REMITTANCE_CURRENCIES as readonly string[]).includes(currency)) {
      return NextResponse.json({ error: 'currency must be GBP, EUR or USD', errors: { currency: 'GBP, EUR or USD' } }, { status: 400 })
    }
    const rail = body.rail as RemittanceRail
    if (!REMITTANCE_RAILS.includes(rail)) {
      return NextResponse.json({ error: 'rail must be uk_local, sepa, swift or us_local', errors: { rail: 'Unknown rail' } }, { status: 400 })
    }
    // Server-side validation runs the SAME pure checks the browser form runs.
    const errors = validateRemittanceAccount(body as never)
    if (Object.keys(errors).length) {
      return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 })
    }

    const account = await createRemittanceAccount({ ...(body as object), currency, rail } as never, supabase)
    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create account' }, { status: 500 })
  }
}
