import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as timesheet from '@/lib/db/timesheet'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok) {
      return authResponse
    }

    const url = new URL(request.url)
    const accountId = url.searchParams.get('account_id')
    const projectId = url.searchParams.get('project_id')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const billable = url.searchParams.get('billable')
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0

    const entries = await timesheet.listTimeEntries(
      {
        account_id: accountId || undefined,
        project_id: projectId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        billable: billable === 'true' ? true : billable === 'false' ? false : undefined,
        limit,
        offset,
      },
      supabase
    )

    return NextResponse.json({ entries })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch time entries'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok) {
      return authResponse
    }

    const body = await request.json()

    const entry = await timesheet.createTimeEntry(
      {
        account_id: body.account_id,
        project_id: body.project_id,
        entry_date: body.entry_date,
        duration_minutes: body.duration_minutes,
        description: body.description,
        billable: body.billable,
        rate_snapshot: body.rate_snapshot,
      },
      supabase
    )

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create time entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
