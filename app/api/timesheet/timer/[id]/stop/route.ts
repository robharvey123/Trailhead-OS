import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as timesheet from '@/lib/db/timesheet'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok) {
      return authResponse
    }

    const body = await request.json()

    const { id } = await params
    const stopped = await timesheet.stopTimer(id, body.rate_snapshot, supabase)

    return NextResponse.json({ entry: stopped })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stop timer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
