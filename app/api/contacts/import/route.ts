import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getApiKeyAuth } from '@/lib/api/auth'
import { crmNormaliseName } from '@/lib/crm/normalise'
import type { ContactStatus } from '@/lib/types'

/** Per-company account decision from the import review step, keyed by normalised company. */
type AccountDecision = { company_norm: string; action: 'link' | 'create' | 'skip'; account_id?: string; account_name?: string }

const CONTACT_STATUSES = new Set<ContactStatus>(['lead', 'active', 'inactive', 'archived'])

async function getAuthenticatedSupabase() {
  const apiKeyAuth = await getApiKeyAuth()
  if (apiKeyAuth) {
    return { supabase: apiKeyAuth.supabase, response: null }
  }

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
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

/** Parse a CSV truthy/falsy cell → boolean, or null when blank/unrecognised. */
function parseBool(value: unknown): boolean | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (['true', 'yes', 'y', '1', 'registered'].includes(v)) return true
  if (['false', 'no', 'n', '0', 'not registered', 'unregistered'].includes(v)) return false
  return null
}

type ImportRow = {
  name?: string
  company?: string
  email?: string
  email_greeting?: string
  phone?: string
  role?: string
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  channel?: string
  website?: string
  sub_trade?: string
  size_signal?: string
  ctps_registered?: string
  ctps_checked_at?: string
  status?: string
  notes?: string
  tags?: string
  account_id?: string
  workstream?: string
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: 'rows array is required' }, { status: 400 })
  }

  const rows: ImportRow[] = body.rows
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 })
  }

  // Optional: global workstream_id and project_id set from UI selectors
  const globalWorkstreamId: string | null = sanitizeText(body.workstream_id)
  const globalProjectId: string | null = sanitizeText(body.project_id)

  // Resolve workstream slugs to IDs
  const slugsInCsv = [
    ...new Set(rows.map((r) => r.workstream).filter(Boolean) as string[]),
  ]
  const workstreamMap = new Map<string, string>()

  if (slugsInCsv.length > 0) {
    const { data: workstreams } = await auth.supabase
      .from('workstreams')
      .select('id, slug')
      .in('slug', slugsInCsv)

    for (const ws of workstreams ?? []) {
      workstreamMap.set(ws.slug, ws.id)
    }
  }

  // Account decisions from the review step (link to an existing account, create a
  // new one, or leave unlinked), keyed by normalised company. New accounts are
  // created lazily and once per company.
  const decisionByNorm = new Map<string, AccountDecision>()
  if (Array.isArray(body.account_decisions)) {
    for (const d of body.account_decisions as AccountDecision[]) {
      if (d && typeof d.company_norm === 'string' && d.company_norm) decisionByNorm.set(d.company_norm, d)
    }
  }
  const createdByNorm = new Map<string, string>()

  async function resolveAccountId(row: ImportRow, workstreamId: string | null): Promise<string | null> {
    const explicit = sanitizeText(row.account_id)
    if (explicit) return explicit
    const norm = crmNormaliseName(sanitizeText(row.company) ?? '')
    if (!norm) return null
    const decision = decisionByNorm.get(norm)
    if (!decision) return null
    if (decision.action === 'link') return decision.account_id ?? null
    if (decision.action === 'create') {
      const cached = createdByNorm.get(norm)
      if (cached) return cached
      const name = sanitizeText(decision.account_name) ?? sanitizeText(row.company)
      if (!name) return null
      const { data: acc, error } = await auth.supabase
        .from('accounts')
        .insert({ name, status: 'prospect', workstream_id: workstreamId })
        .select('id')
        .single()
      if (error || !acc) return null
      createdByNorm.set(norm, acc.id)
      return acc.id
    }
    return null
  }

  // Duplicate guard: pre-load existing contact emails (lowercased). Rows whose
  // email already exists are rejected rather than inserted a second time; the set
  // also grows as we insert, so duplicates within the same file are caught too.
  const { data: existingContacts } = await auth.supabase.from('contacts').select('email').not('email', 'is', null)
  const existingEmails = new Set((existingContacts ?? []).map((c) => (c.email as string).toLowerCase()))

  const inserted: Array<{ row: number; name: string; id: string }> = []
  const rejected: Array<{ row: number; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = sanitizeText(row.name)

    if (!name) {
      rejected.push({ row: i + 1, reason: 'Name is required' })
      continue
    }

    const emailLower = sanitizeText(row.email)?.toLowerCase() ?? null
    if (emailLower && existingEmails.has(emailLower)) {
      rejected.push({ row: i + 1, reason: 'duplicate email' })
      continue
    }

    const status = row.status && CONTACT_STATUSES.has(row.status as ContactStatus)
      ? (row.status as ContactStatus)
      : 'lead'

    const tags = row.tags
      ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : []

    // Resolve workstream: CSV slug → ID, or fall back to global
    const rowWorkstreamId = row.workstream
      ? workstreamMap.get(row.workstream) ?? null
      : null
    const workstreamId = rowWorkstreamId || globalWorkstreamId

    const resolvedAccountId = await resolveAccountId(row, workstreamId)

    const { data: contact, error } = await auth.supabase
      .from('contacts')
      .insert({
        name,
        company: sanitizeText(row.company),
        email: sanitizeText(row.email),
        email_greeting: sanitizeText(row.email_greeting),
        phone: sanitizeText(row.phone),
        role: sanitizeText(row.role),
        address_line1: sanitizeText(row.address_line1),
        address_line2: sanitizeText(row.address_line2),
        city: sanitizeText(row.city),
        postcode: sanitizeText(row.postcode),
        country: sanitizeText(row.country),
        channel: sanitizeText(row.channel),
        website: sanitizeText(row.website),
        sub_trade: sanitizeText(row.sub_trade),
        size_signal: sanitizeText(row.size_signal),
        ctps_registered: parseBool(row.ctps_registered),
        ctps_checked_at: sanitizeText(row.ctps_checked_at),
        status,
        notes: sanitizeText(row.notes),
        tags,
        account_id: resolvedAccountId,
        workstream_id: workstreamId,
      })
      .select('id')
      .single()

    if (error) {
      rejected.push({ row: i + 1, reason: error.message })
    } else {
      inserted.push({ row: i + 1, name, id: contact.id })
      if (emailLower) existingEmails.add(emailLower)
    }
  }

  // Link all inserted contacts to selected project
  if (globalProjectId && inserted.length > 0) {
    const projectLinks = inserted.map((c) => ({
      project_id: globalProjectId,
      contact_id: c.id,
    }))

    await auth.supabase
      .from('project_contacts')
      .upsert(projectLinks, { onConflict: 'project_id,contact_id' })
  }

  return NextResponse.json({ inserted: inserted.length, rejected }, { status: 201 })
}
