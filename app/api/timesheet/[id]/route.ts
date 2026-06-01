import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as timesheet from '@/lib/db/timesheet'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok) {
      return authResponse
    }

    const { id } = await params
    const entry = await timesheet.getTimeEntryById(id, supabase)

    if (!entry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch time entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
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
    const updated = await timesheet.updateTimeEntry(id, body, supabase)

    return NextResponse.json({ entry: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update time entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()

    if (!ok) {
      return authResponse
    }

    const { id } = await params
    await timesheet.deleteTimeEntry(id, supabase)

    return NextResponse.json({})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete time entry'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
