import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { deleteAccount, getAccountById, updateAccount } from '@/lib/db/accounts'
import type { AccountStatus } from '@/lib/types'

const ACCOUNT_STATUSES = new Set<AccountStatus>([
  'prospect',
  'active',
  'inactive',
  'archived',
])

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
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
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const account = await getAccountById(id, auth.supabase)

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json({ account })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load account' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
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

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ACCOUNT_STATUSES.has(body.status as AccountStatus)) {
      return NextResponse.json({ error: 'Invalid account status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.workstream_id !== undefined) {
    if (body.workstream_id !== null && typeof body.workstream_id !== 'string') {
      return NextResponse.json({ error: 'workstream_id must be a string or null' }, { status: 400 })
    }
    patch.workstream_id = body.workstream_id
  }

  if (body.size !== undefined) {
    patch.size = typeof body.size === 'string' && body.size.trim() ? body.size : null
  }

  if (body.website !== undefined) patch.website = sanitizeText(body.website)
  if (body.industry !== undefined) patch.industry = sanitizeText(body.industry)
  if (body.address_line1 !== undefined) patch.address_line1 = sanitizeText(body.address_line1)
  if (body.address_line2 !== undefined) patch.address_line2 = sanitizeText(body.address_line2)
  if (body.city !== undefined) patch.city = sanitizeText(body.city)
  if (body.postcode !== undefined) patch.postcode = sanitizeText(body.postcode)
  if (body.country !== undefined) patch.country = sanitizeText(body.country)
  if (body.notes !== undefined) patch.notes = sanitizeText(body.notes)

  if (body.tags !== undefined) {
    const tags = sanitizeTags(body.tags)
    if (!tags) {
      return NextResponse.json({ error: 'tags must be an array of strings' }, { status: 400 })
    }
    patch.tags = tags
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const account = await updateAccount(id, patch, auth.supabase)
    return NextResponse.json({ account })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update account' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    await deleteAccount(id, auth.supabase)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete account' },
      { status: 500 }
    )
  }
}
