import { NextRequest, NextResponse } from 'next/server'
import {
  addDays,
  endOfDayIso,
  jsonError,
  mapCalendarEvent,
  maybeGetWorkstreamBySlug,
  optionalIsoDatetime,
  optionalString,
  parseDateParam,
  requiredString,
  requireCoworkAuth,
  startOfDayIso,
  todayDate,
} from '@/lib/cowork-api'
import { pushEventToGoogle } from '@/lib/google/calendar'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const start = parseDateParam(searchParams.get('start'), 'start') ?? todayDate()
    const end = parseDateParam(searchParams.get('end'), 'end') ?? addDays(start, 7)

    if (end < start) {
      return NextResponse.json({ error: 'end must be on or after start' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('calendar_events')
      .select('id, title, description, start_at, end_at, all_day, workstream_id, contact_id, location, colour, created_at, updated_at')
      .gte('start_at', startOfDayIso(start))
      .lte('start_at', endOfDayIso(end))
      .order('start_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json((data ?? []).map((row) => mapCalendarEvent(row)))
  } catch (error) {
    return jsonError(error, 'Failed to load calendar events')
  }
}

export async function POST(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const body = await request.json().catch(() => ({}))
    const title = requiredString(body.title, 'title')
    const startAt = optionalIsoDatetime(body.start_at, 'start_at')
    const endAt = optionalIsoDatetime(body.end_at, 'end_at')

    if (!startAt || !endAt) {
      return NextResponse.json({ error: 'start_at and end_at are required' }, { status: 400 })
    }

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return NextResponse.json({ error: 'end_at must be on or after start_at' }, { status: 400 })
    }

    const workstream = await maybeGetWorkstreamBySlug(optionalString(body.workstream))

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
      .select('id, title, description, start_at, end_at, all_day, workstream_id, contact_id, location, colour, created_at, updated_at')
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

      await pushEventToGoogle(data)
    })().catch(() => {})

    return NextResponse.json(mapCalendarEvent(data), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create calendar event')
  }
}
