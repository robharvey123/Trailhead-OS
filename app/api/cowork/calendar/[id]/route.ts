import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { formatCalendarEvent, getCalendarEventById, jsonError } from '@/lib/cowork-api'
import { deleteCoworkCalendarEvent, updateCoworkCalendarEvent } from '@/lib/cowork-calendar'

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

// PATCH — any of CALENDAR_EVENT_PATCH_FIELDS (lib/cowork-calendar.ts). 409 on a
// read-only (feed / secondary-calendar) event.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    return Response.json(await updateCoworkCalendarEvent(id, body))
  } catch (error) {
    return jsonError(error, 'Failed to update calendar event')
  }
}

// DELETE — permanent, and removes the Google copy. 409 on a read-only event.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    return Response.json(await deleteCoworkCalendarEvent(id))
  } catch (error) {
    return jsonError(error, 'Failed to delete calendar event')
  }
}
