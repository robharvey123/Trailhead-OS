import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  CALENDAR_EVENT_SELECT,
  formatCalendarEvent,
  getCalendarEventById,
  getWorkstreamBySlug,
  jsonError,
  optionalIsoDatetime,
  optionalString,
} from '@/lib/cowork-api'
import { deleteGcalEvent, pushEventToGoogle } from '@/lib/google/calendar'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const event = await getCalendarEventById(id)
    return Response.json(formatCalendarEvent(event))
  } catch (error) {
    return jsonError(error, 'Failed to load calendar event')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existing = await getCalendarEventById(id)
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = optionalString(body.title)
      if (!title) {
        return Response.json({ error: 'title must be a non-empty string' }, { status: 400 })
      }
      patch.title = title
    }

    if (body.start_at !== undefined) {
      patch.start_at = optionalIsoDatetime(body.start_at, 'start_at')
    }

    if (body.end_at !== undefined) {
      patch.end_at = optionalIsoDatetime(body.end_at, 'end_at')
    }

    if (body.all_day !== undefined) {
      if (typeof body.all_day !== 'boolean') {
        return Response.json({ error: 'all_day must be a boolean' }, { status: 400 })
      }
      patch.all_day = body.all_day
    }

    if (body.location !== undefined) {
      patch.location = optionalString(body.location)
    }

    if (body.description !== undefined) {
      patch.description = optionalString(body.description)
    }

    if (body.colour !== undefined) {
      patch.colour = optionalString(body.colour)
    }

    if (body.workstream !== undefined) {
      const slug = optionalString(body.workstream)
      patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const startAt = String(patch.start_at ?? existing.start_at)
    const endAt = String(patch.end_at ?? existing.end_at)

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return Response.json({ error: 'end_at must be on or after start_at' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('calendar_events')
      .update(patch)
      .eq('id', id)
      .select(CALENDAR_EVENT_SELECT)
      .single()

    if (error) {
      throw error
    }

    if ((data as { gcal_sync?: unknown }).gcal_sync) {
      void pushEventToGoogle(data as never).catch(() => {})
    }

    return Response.json(formatCalendarEvent(data as never))
  } catch (error) {
    return jsonError(error, 'Failed to update calendar event')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    await getCalendarEventById(id)

    void deleteGcalEvent(id).catch(() => {})

    const { error } = await supabaseService
      .from('calendar_events')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete calendar event')
  }
}
