import { NextRequest, NextResponse } from 'next/server'
import {
  createCalendarEvent,
  getCalendarEvents,
  type CreateCalendarEventInput,
} from '@/lib/db/calendar-events'
import { getTasks } from '@/lib/db/tasks'
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
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function sanitizeOptionalId(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  return typeof value === 'string' ? value : null
}

function dateKeyFromIso(value: string) {
  return value.slice(0, 10)
}

function endExclusiveToInclusive(value: string) {
  return new Date(new Date(value).getTime() - 1).toISOString()
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const startParam = request.nextUrl.searchParams.get('start')
  const endParam = request.nextUrl.searchParams.get('end')

  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end query params are required' }, { status: 400 })
  }

  try {
    const start = parseIsoDateTime(startParam, 'start')
    const end = endExclusiveToInclusive(parseIsoDateTime(endParam, 'end'))

    const [events, tasks] = await Promise.all([
      getCalendarEvents({ start_at_gte: start, start_at_lte: end }, auth.supabase),
      getTasks(
        {
          due_date_from: dateKeyFromIso(start),
          due_date_to: dateKeyFromIso(end),
        },
        auth.supabase
      ),
    ])

    return NextResponse.json({ events, tasks: tasks.filter((task) => task.due_date !== null) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load calendar data'
    const status = message.includes('must be an ISO datetime string') ? 400 : 500

    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const start_at = parseIsoDateTime(body.start_at, 'start_at')
    const end_at = parseIsoDateTime(body.end_at, 'end_at')

    if (new Date(end_at).getTime() < new Date(start_at).getTime()) {
      return NextResponse.json({ error: 'end_at must be greater than or equal to start_at' }, { status: 400 })
    }

    const input: CreateCalendarEventInput = {
      title,
      description: sanitizeOptionalText(body.description),
      start_at,
      end_at,
      all_day: body.all_day === true,
      workstream_id: sanitizeOptionalId(body.workstream_id),
      contact_id: sanitizeOptionalId(body.contact_id),
      location: sanitizeOptionalText(body.location),
      colour: sanitizeOptionalText(body.colour),
    }

    const event = await createCalendarEvent(input, auth.supabase)
    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create calendar event'
    const status = message.includes('must be an ISO datetime string') ? 400 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
