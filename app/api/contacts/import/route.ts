import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getApiKeyAuth } from '@/lib/api/auth'
import type { ContactStatus } from '@/lib/types'

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

type ImportRow = {
  name?: string
  company?: string
  email?: string
  phone?: string
  role?: string
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  channel?: string
  website?: string
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

  const inserted: Array<{ row: number; name: string; id: string }> = []
  const rejected: Array<{ row: number; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const name = sanitizeText(row.name)

    if (!name) {
      rejected.push({ row: i + 1, reason: 'Name is required' })
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

    const { data: contact, error } = await auth.supabase
      .from('contacts')
      .insert({
        name,
        company: sanitizeText(row.company),
        email: sanitizeText(row.email),
        phone: sanitizeText(row.phone),
        role: sanitizeText(row.role),
        address_line1: sanitizeText(row.address_line1),
        address_line2: sanitizeText(row.address_line2),
        city: sanitizeText(row.city),
        postcode: sanitizeText(row.postcode),
        country: sanitizeText(row.country),
        channel: sanitizeText(row.channel),
        website: sanitizeText(row.website),
        status,
        notes: sanitizeText(row.notes),
        tags,
        account_id: sanitizeText(row.account_id) || null,
        workstream_id: workstreamId,
      })
      .select('id')
      .single()

    if (error) {
      rejected.push({ row: i + 1, reason: error.message })
    } else {
      inserted.push({ row: i + 1, name, id: contact.id })
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
