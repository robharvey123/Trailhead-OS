import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { syncMailbox } from '@/lib/google/gmail-sync'

// On-demand Gmail sync. POST { sinceDays?: number } — defaults to 7.
// Use { sinceDays: 90 } for the first-connect backfill.
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({}))
    const sinceDays = Number(body.sinceDays) > 0 ? Number(body.sinceDays) : 7
    const result = await syncMailbox({ sinceDays })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync Gmail' },
      { status: 500 }
    )
  }
}
