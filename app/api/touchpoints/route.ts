import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createTouchpoint, getTouchpoints } from '@/lib/db/touchpoints'
import type { Touchpoint, TouchpointType } from '@/lib/types'

const TOUCHPOINT_TYPES = new Set<TouchpointType>([
  'call',
  'email',
  'message',
  'meeting',
  'note',
])

function sanitizeText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const touchpoints = await getTouchpoints(
      {
        account_id: searchParams.get('account_id') ?? undefined,
        contact_id: searchParams.get('contact_id') ?? undefined,
        engagement_id: searchParams.get('engagement_id') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ touchpoints })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load touchpoints' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const subject = sanitizeText(body.subject) ?? ''
  const type =
    typeof body.type === 'string' && TOUCHPOINT_TYPES.has(body.type as TouchpointType)
      ? (body.type as TouchpointType)
      : 'note'

  if (!subject) {
    return NextResponse.json({ error: 'subject is required' }, { status: 400 })
  }

  if (
    (typeof body.account_id !== 'string' || !body.account_id) &&
    (typeof body.contact_id !== 'string' || !body.contact_id) &&
    (typeof body.engagement_id !== 'string' || !body.engagement_id)
  ) {
    return NextResponse.json(
      { error: 'account_id, contact_id or engagement_id is required' },
      { status: 400 }
    )
  }

  // Only keep event_id if it points at a real calendar_events row (manual/synced
  // events are stored; external feed events are not) so the FK never rejects the log.
  let eventId: string | null = null
  if (typeof body.event_id === 'string' && body.event_id) {
    const { data: ev } = await auth.supabase
      .from('calendar_events')
      .select('id')
      .eq('id', body.event_id)
      .maybeSingle()
    eventId = ev ? body.event_id : null
  }

  try {
    const touchpoint = await createTouchpoint(
      {
        account_id:
          typeof body.account_id === 'string' && body.account_id ? body.account_id : null,
        contact_id:
          typeof body.contact_id === 'string' && body.contact_id ? body.contact_id : null,
        engagement_id:
          typeof body.engagement_id === 'string' && body.engagement_id ? body.engagement_id : null,
        event_id: eventId,
        type,
        subject,
        body: sanitizeText(body.body),
        occurred_at:
          typeof body.occurred_at === 'string' && body.occurred_at.trim()
            ? body.occurred_at
            : new Date().toISOString(),
      } satisfies Omit<Touchpoint, 'id' | 'created_at' | 'updated_at'>,
      auth.supabase
    )

    return NextResponse.json({ touchpoint }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create touchpoint' },
      { status: 500 }
    )
  }
}
