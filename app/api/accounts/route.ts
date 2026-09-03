import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createAccount, getAccounts } from '@/lib/db/accounts'
import type { Account, AccountStatus } from '@/lib/types'

const ACCOUNT_STATUSES = new Set<AccountStatus>([
  'prospect',
  'contacted',
  'active',
  'listed',
  'declined',
  'on_hold',
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

function sanitizeTags(value: unknown): string[] {
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
  if (!auth.ok) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const accounts = await getAccounts(
      {
        workstream_id: searchParams.get('workstream_id') ?? undefined,
        status:
          status && ACCOUNT_STATUSES.has(status as AccountStatus)
            ? (status as AccountStatus)
            : undefined,
        channel: searchParams.get('channel') ?? undefined,
        search: searchParams.get('search') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ accounts })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load accounts' },
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
  const name = sanitizeText(body.name) ?? ''
  const status =
    typeof body.status === 'string' && ACCOUNT_STATUSES.has(body.status as AccountStatus)
      ? (body.status as AccountStatus)
      : 'prospect'

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const account = await createAccount(
      {
        name,
        website: sanitizeText(body.website) ?? undefined,
        industry: sanitizeText(body.industry) ?? undefined,
        size:
          typeof body.size === 'string' && body.size.trim()
            ? body.size
            : undefined,
        workstream_id:
          body.workstream_id === null || body.workstream_id === undefined
            ? undefined
            : typeof body.workstream_id === 'string'
              ? body.workstream_id
              : undefined,
        status,
        address_line1: sanitizeText(body.address_line1) ?? undefined,
        address_line2: sanitizeText(body.address_line2) ?? undefined,
        city: sanitizeText(body.city) ?? undefined,
        postcode: sanitizeText(body.postcode) ?? undefined,
        country: sanitizeText(body.country) ?? 'UK',
        notes: sanitizeText(body.notes) ?? undefined,
        tags: sanitizeTags(body.tags),
        channel: sanitizeText(body.channel) ?? undefined,
        source: sanitizeText(body.source) ?? undefined,
        email_contact: sanitizeText(body.email_contact) ?? undefined,
        hq_address: sanitizeText(body.hq_address) ?? undefined,
        vat_number: sanitizeText(body.vat_number) ?? undefined,
        company_number: sanitizeText(body.company_number) ?? undefined,
        billing_email: sanitizeText(body.billing_email) ?? undefined,
        payment_terms_days: Number.isInteger(Number(body.payment_terms_days)) && Number(body.payment_terms_days) >= 0 ? Number(body.payment_terms_days) : undefined,
        po_required: body.po_required === true,
      } as Omit<Account, 'id' | 'created_at' | 'updated_at'>,
      auth.supabase
    )

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create account' },
      { status: 500 }
    )
  }
}
