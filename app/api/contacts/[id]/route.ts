import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import {
  deleteContact,
  getContactById,
  updateContact,
} from '@/lib/db/contacts'
import type { ContactStatus } from '@/lib/types'

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
    const contact = await getContactById(id, auth.supabase)

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    return NextResponse.json({ contact })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load contact' },
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
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = sanitizeText(body.name)
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    patch.name = name
  }

  if (body.workstream_id !== undefined) {
    if (body.workstream_id !== null && typeof body.workstream_id !== 'string') {
      return NextResponse.json({ error: 'workstream_id must be a string or null' }, { status: 400 })
    }
    patch.workstream_id = body.workstream_id
  }

  if (body.account_id !== undefined) {
    if (body.account_id !== null && typeof body.account_id !== 'string') {
      return NextResponse.json({ error: 'account_id must be a string or null' }, { status: 400 })
    }
    patch.account_id = body.account_id
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !CONTACT_STATUSES.has(body.status as ContactStatus)) {
      return NextResponse.json(
        { error: 'status must be lead, active, inactive, or archived' },
        { status: 400 }
      )
    }
    patch.status = body.status
  }

  if (body.company !== undefined) patch.company = sanitizeText(body.company)
  if (body.email !== undefined) patch.email = sanitizeText(body.email)
  if (body.phone !== undefined) patch.phone = sanitizeText(body.phone)
  if (body.role !== undefined) patch.role = sanitizeText(body.role)
  if (body.notes !== undefined) patch.notes = sanitizeText(body.notes)
  if (body.tags !== undefined) patch.tags = sanitizeStringArray(body.tags)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const contact = await updateContact(id, patch, auth.supabase)
    return NextResponse.json({ contact })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    )
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
    await deleteContact(id, auth.supabase)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete contact' },
      { status: 500 }
    )
  }
}
