import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { createContact, getContacts } from '@/lib/db/contacts'
import type { Contact, ContactStatus } from '@/lib/types'

const CONTACT_STATUSES = new Set<ContactStatus>(['lead', 'active', 'inactive', 'archived'])

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

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const contacts = await getContacts(
      {
        workstream_id: searchParams.get('workstream_id') ?? undefined,
        status:
          status && CONTACT_STATUSES.has(status as ContactStatus)
            ? status as ContactStatus
            : undefined,
        search: searchParams.get('search') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ contacts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load contacts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const name = sanitizeText(body.name) ?? ''
  const status = typeof body.status === 'string' ? body.status : 'lead'

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!CONTACT_STATUSES.has(status as ContactStatus)) {
    return NextResponse.json(
      { error: 'status must be lead, active, inactive, or archived' },
      { status: 400 }
    )
  }

  const payload: Omit<Contact, 'id' | 'created_at' | 'updated_at'> = {
    name,
    workstream_id:
      body.workstream_id === null || body.workstream_id === undefined
        ? null
        : typeof body.workstream_id === 'string'
          ? body.workstream_id
          : null,
    company: sanitizeText(body.company),
    email: sanitizeText(body.email),
    phone: sanitizeText(body.phone),
    role: sanitizeText(body.role),
    status: status as ContactStatus,
    notes: sanitizeText(body.notes),
    tags: sanitizeStringArray(body.tags),
  }

  try {
    const contact = await createContact(payload, auth.supabase)
    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    )
  }
}
