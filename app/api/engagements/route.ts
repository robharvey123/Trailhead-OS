import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as engagements from '@/lib/db/engagements'
import type { EngagementStatus } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const url = new URL(request.url)
    const list = await engagements.listEngagements(
      {
        status: (url.searchParams.get('status') as EngagementStatus) || undefined,
        accountId: url.searchParams.get('account_id') || undefined,
      },
      supabase
    )
    return NextResponse.json({ engagements: list })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load engagements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const body = await request.json()
    // Internal engagements have no end client; client engagements still require one.
    const isInternal = body.engagement_type === 'internal_app_build' || body.engagement_type === 'internal_ops'
    if (!body.name || !body.start_date || (!isInternal && !body.end_client_account_id)) {
      return NextResponse.json(
        { error: isInternal ? 'name and start_date are required' : 'name, end_client_account_id and start_date are required' },
        { status: 400 }
      )
    }
    const engagement = await engagements.upsertEngagement(body, supabase)
    return NextResponse.json({ engagement }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create engagement' }, { status: 500 })
  }
}
