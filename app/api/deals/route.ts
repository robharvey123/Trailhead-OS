import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as deals from '@/lib/db/deals'
import type { DealStage } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const url = new URL(request.url)
    const accountId = url.searchParams.get('account_id')
    const stage = url.searchParams.get('stage')
    const search = url.searchParams.get('search')

    const list = await deals.listDeals(
      {
        account_id: accountId || undefined,
        stage: (stage as DealStage) || undefined,
        search: search || undefined,
      },
      supabase
    )

    return NextResponse.json({ deals: list })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deals'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const body = await request.json()
    if (!body.account_id || !body.name) {
      return NextResponse.json({ error: 'account_id and name are required' }, { status: 400 })
    }

    const saved = await deals.upsertDeal(body, supabase)
    const deal = (await deals.getDeal(saved.id, supabase)) ?? saved
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create deal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
