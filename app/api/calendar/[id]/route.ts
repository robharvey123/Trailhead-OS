import { NextRequest, NextResponse } from 'next/server'
import {
  deleteCalendarEvent,
  getCalendarEventById,
  updateCalendarEvent,
  type UpdateCalendarEventInput,
} from '@/lib/db/calendar-events'
import { deleteGcalEvent, pushEventToGoogle } from '@/lib/google/calendar'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

async function getAuthenticatedSupabase() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { supabase, response: null }
}

function parseIsoDateTime(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be an ISO datetime string`)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be an ISO datetime string`)
  }

  return date.toISOString()
}

function sanitizeOptionalText(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Optional text fields must be strings or null')
  }

  const trimmed = value.trim()
  return trimmed || null
}

function sanitizeOptionalId(value: unknown, field: string) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`)
  }

  return value
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const { id } = await params

  try {
    const event = await getCalendarEventById(id, auth.supabase)

    if (!event) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
    }

    return NextResponse.json({ event })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load calendar event' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const { id } = await params

  try {
    const existing = await getCalendarEventById(id, auth.supabase)

    if (!existing) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const patch: UpdateCalendarEventInput = {}

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
      }
      patch.title = body.title
    }

    if (body.description !== undefined) {
      patch.description = sanitizeOptionalText(body.description)
    }

    if (body.start_at !== undefined) {
      patch.start_at = parseIsoDateTime(body.start_at, 'start_at')
    }

    if (body.end_at !== undefined) {
      patch.end_at = parseIsoDateTime(body.end_at, 'end_at')
    }

    if (body.all_day !== undefined) {
      if (typeof body.all_day !== 'boolean') {
        return NextResponse.json({ error: 'all_day must be a boolean' }, { status: 400 })
      }
      patch.all_day = body.all_day
    }

    if (body.workstream_id !== undefined) {
      patch.workstream_id = sanitizeOptionalId(body.workstream_id, 'workstream_id')
    }

    if (body.contact_id !== undefined) {
      patch.contact_id = sanitizeOptionalId(body.contact_id, 'contact_id')
    }

    if (body.location !== undefined) {
      patch.location = sanitizeOptionalText(body.location)
    }

    if (body.colour !== undefined) {
      patch.colour = sanitizeOptionalText(body.colour)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const startAt = patch.start_at ?? existing.start_at
    const endAt = patch.end_at ?? existing.end_at

    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return NextResponse.json({ error: 'end_at must be greater than or equal to start_at' }, { status: 400 })
    }

    const event = await updateCalendarEvent(id, patch, auth.supabase)

    void (async () => {
      const { data: syncRow } = await auth.supabase
        .from('gcal_sync')
        .select('id')
        .eq('calendar_event_id', id)
        .limit(1)

      if (!syncRow?.length) {
        return
      }

      await pushEventToGoogle(event)
    })().catch(() => {})

    return NextResponse.json({ event })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update calendar event'
    const status = message.includes('must be') ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const { id } = await params

  try {
    const existing = await getCalendarEventById(id, auth.supabase)

    if (!existing) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
    }

    await deleteGcalEvent(id)
    await deleteCalendarEvent(id, auth.supabase)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete calendar event' },
      { status: 500 }
    )
  }
}
