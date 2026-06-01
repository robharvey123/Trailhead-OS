import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as timesheet from '@/lib/db/timesheet'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok || !supabase) {
      return authResponse
    }

    const running = await timesheet.getRunningTimer(supabase)

    return NextResponse.json({ timer: running })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch running timer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok || !supabase) {
      return authResponse
    }

    const body = await request.json()

    const timer = await timesheet.startTimer(
      {
        account_id: body.account_id,
        project_id: body.project_id,
        description: body.description,
      },
      supabase
    )

    return NextResponse.json({ timer }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start timer'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
