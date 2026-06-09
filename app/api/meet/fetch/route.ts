import { NextResponse, type NextRequest } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { supabaseService } from '@/lib/supabase/service'
import { getAllGoogleTokens } from '@/lib/google/oauth'
import { fetchMeetArtifacts } from '@/lib/google/meet'
import type { CalendarEvent } from '@/lib/types'

export const maxDuration = 60

// Manual Phase-1 trigger: fetch one meeting's transcript + Gemini summary for a
// calendar event and return the normalised object. Does NOT persist — that's the
// cron's job. Server-side only; transcript/Doc bodies never reach the client store.
export async function POST(request: NextRequest) {
  const { ok, response, supabase } = await getAuthenticatedSupabase()
  if (!ok) return response

  try {
    const { calendarEventId } = (await request.json()) as { calendarEventId?: string }
    if (!calendarEventId) {
      return NextResponse.json({ error: 'calendarEventId is required' }, { status: 400 })
    }

    // RLS-scoped read of the event.
    const { data: event } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', calendarEventId)
      .maybeSingle<CalendarEvent>()
    if (!event) return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })

    // Use the Google account that owns the event, falling back to the first connected one.
    const { data: sync } = await supabaseService
      .from('gcal_sync')
      .select('google_token_id')
      .eq('calendar_event_id', calendarEventId)
      .maybeSingle()
    const tokens = await getAllGoogleTokens()
    const tokenRow =
      tokens.find((t) => t.id === (sync?.google_token_id as string | undefined)) ?? tokens[0]
    if (!tokenRow) return NextResponse.json({ error: 'No Google account connected' }, { status: 400 })

    const meeting = await fetchMeetArtifacts(event, tokenRow)
    return NextResponse.json({ meeting })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Meet fetch failed' },
      { status: 500 }
    )
  }
}
