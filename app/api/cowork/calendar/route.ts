import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  CALENDAR_EVENT_SELECT,
  addDays,
  formatCalendarEvent,
  getWorkstreamBySlug,
  jsonError,
  optionalIsoDatetime,
  optionalString,
  parseDateParam,
  requiredString,
  todayDate,
} from '@/lib/cowork-api'
import { pushEventToGoogle } from '@/lib/google/calendar'
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

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = requiredString(body.title, 'title')
    const startAt = optionalIsoDatetime(body.start_at, 'start_at')
    const endAt = optionalIsoDatetime(body.end_at, 'end_at')

    if (!startAt || !endAt) {
      return Response.json({ error: 'start_at and end_at are required' }, { status: 400 })
    }

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return Response.json({ error: 'end_at must be on or after start_at' }, { status: 400 })
    }

    const workstreamSlug = optionalString(body.workstream)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    const { data, error } = await supabaseService
      .from('calendar_events')
      .insert({
        title,
        start_at: startAt,
        end_at: endAt,
        all_day: body.all_day === true,
        location: optionalString(body.location),
        description: optionalString(body.description),
        workstream_id: workstream?.id ?? null,
        colour: optionalString(body.colour),
      })
      .select(CALENDAR_EVENT_SELECT)
      .single()

    if (error) {
      throw error
    }

    void (async () => {
      const { data: tokenRow } = await supabaseService
        .from('google_tokens')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (!tokenRow) {
        return
      }

      await pushEventToGoogle(data as never)
    })().catch(() => {})

    return Response.json(formatCalendarEvent(data as never), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create calendar event')
  }
}
