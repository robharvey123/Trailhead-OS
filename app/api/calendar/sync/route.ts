import { NextRequest, NextResponse } from 'next/server'
import type { CalendarEvent } from '@/lib/types'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { pullEventsFromGoogle, pushEventToGoogle } from '@/lib/google/calendar'

type SyncDirection = 'push' | 'pull' | 'both'

function isSyncDirection(value: unknown): value is SyncDirection {
  return value === 'push' || value === 'pull' || value === 'both'
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const direction = body.direction

  if (!isSyncDirection(direction)) {
    return NextResponse.json(
      { error: "direction must be 'push', 'pull', or 'both'" },
      { status: 400 }
    )
  }

  const days = Math.max(1, Number.parseInt(String(body.days ?? '30'), 10) || 30)

  try {
    let pushed = 0
    let pulled = 0

    if (direction === 'push' || direction === 'both') {
      const [{ data: localEvents, error }, { data: syncRows, error: syncError }] = await Promise.all([
        auth.supabase.from('calendar_events').select('*'),
        auth.supabase.from('gcal_sync').select('calendar_event_id'),
      ])

      if (error || syncError) {
        throw new Error(error?.message || syncError?.message || 'Failed to load calendar sync state')
      }

      const syncedIds = new Set((syncRows ?? []).map(row => row.calendar_event_id))
      const unsyncedEvents = ((localEvents ?? []) as CalendarEvent[]).filter(
        event => !syncedIds.has(event.id)
      )

      for (const event of unsyncedEvents) {
        await pushEventToGoogle(event)
        pushed += 1
      }
    }

    if (direction === 'pull' || direction === 'both') {
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      const result = await pullEventsFromGoogle(timeMin, timeMax)
      pulled = result.synced
    }

    return NextResponse.json({ pushed, pulled })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync calendar events' },
      { status: 500 }
    )
  }
}
