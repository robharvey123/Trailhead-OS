import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import {
  listGoogleCalendars,
  getCalendarSelections,
  upsertCalendarSelection,
} from '@/lib/google/calendar'

type RouteParams = { params: Promise<{ tokenId: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { tokenId } = await params

  try {
    const [calendars, selections] = await Promise.all([
      listGoogleCalendars(tokenId),
      getCalendarSelections(tokenId),
    ])

    const selectionMap = new Map(
      selections.map((s) => [s.gcal_calendar_id, s])
    )

    const merged = calendars.map((cal) => {
      const selection = selectionMap.get(cal.id)
      return {
        ...cal,
        enabled: selection?.enabled ?? false,
        sync_direction: selection?.sync_direction ?? 'pull',
        selection_id: selection?.id ?? null,
      }
    })

    return NextResponse.json({ calendars: merged })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to list calendars',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { tokenId } = await params
  const body = await request.json().catch(() => ({}))

  if (!Array.isArray(body.calendars)) {
    return NextResponse.json(
      { error: 'calendars array is required' },
      { status: 400 }
    )
  }

  try {
    const results = []

    for (const cal of body.calendars) {
      if (!cal.id || typeof cal.enabled !== 'boolean') continue

      const result = await upsertCalendarSelection(
        tokenId,
        cal.id,
        cal.name ?? cal.id,
        cal.enabled,
        cal.colour ?? null,
        cal.sync_direction ?? 'pull'
      )
      results.push(result)
    }

    return NextResponse.json({ selections: results })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update calendar selections',
      },
      { status: 500 }
    )
  }
}
