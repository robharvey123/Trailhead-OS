import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { crmNormaliseName } from '@/lib/crm/normalise'
import { suggestAccount, type AccountLite } from '@/lib/crm/matching'

type Item = { company?: string; email?: string; website?: string }

/**
 * Given the companies in a pending import, return an account suggestion set per
 * distinct company (normalised), so the importer can link rather than create a
 * fresh duplicate. Archived accounts (merge losers) are never suggested.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const items: Item[] = Array.isArray(body.items) ? body.items : []

  const { data } = await auth.supabase
    .from('accounts')
    .select('id, name, website, email_contact')
    .eq('record_type', 'sales')
    .neq('status', 'archived')
  const accounts = (data ?? []) as AccountLite[]

  // One decision per normalised company; keep the first email/website we see for it.
  const seen = new Map<string, Item>()
  for (const it of items) {
    const company = (it.company ?? '').trim()
    if (!company) continue
    const norm = crmNormaliseName(company)
    if (!norm || seen.has(norm)) continue
    seen.set(norm, { company, email: it.email, website: it.website })
  }

  const results = [...seen.entries()].map(([norm, it]) => ({
    norm,
    company: it.company as string,
    suggestions: suggestAccount({ company: it.company, email: it.email, website: it.website }, accounts),
  }))

  return NextResponse.json({ results })
}
