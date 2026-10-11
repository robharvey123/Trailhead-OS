import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  CALENDAR_EVENT_SELECT,
  addDays,
  formatCalendarEvent,
  getWorkstreamBySlug,
  jsonError,
  parseDateParam,
  todayDate,
} from '@/lib/cowork-api'
import { createCoworkCalendarEvent } from '@/lib/cowork-calendar'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const start = parseDateParam(searchParams.get('start'), 'start') ?? todayDate()
    const end = parseDateParam(searchParams.get('end'), 'end') ?? addDays(start, 30)
    const workstreamSlug = searchParams.get('workstream')
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    if (end < start) {
      return Response.json({ error: 'end must be on or after start' }, { status: 400 })
    }

    let query = supabaseService
      .from('calendar_events')
      .select(CALENDAR_EVENT_SELECT)
      .gte('start_at', `${start}T00:00:00.000Z`)
      .lte('start_at', `${end}T23:59:59.999Z`)
      .order('start_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return Response.json((data ?? []).map((row) => formatCalendarEvent(row as never)))
  } catch (error) {
    return jsonError(error, 'Failed to load calendar events')
  }
}

// POST — create. Optional contact_id / project_id / engagement_id links (uuid,
// must exist). Pushed to Google when a Google account is connected.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    return Response.json(await createCoworkCalendarEvent(body), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create calendar event')
  }
}
