import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

/**
 * Workspace-free global search across the OS.
 *
 * The previous `components/nav/GlobalSearch` only worked under `/workspace/:id`,
 * a route that no longer exists in the OS — so the app shipped with no search at
 * all. This endpoint searches the OS tables directly and returns results already
 * shaped with the href the palette should navigate to.
 */

export type SearchHit = {
  id: string
  label: string
  sub: string | null
  module: string
  href: string
}

const MIN_QUERY = 2
const PER_MODULE = 5

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < MIN_QUERY) return NextResponse.json({ results: [] })

    // Escape PostgREST's ilike wildcards so a literal % or _ doesn't match everything.
    const pattern = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`

    const [tasks, accounts, contacts, deals, invoices, quotes, projects, engagements] =
      await Promise.all([
        supabase.from('tasks').select('id, title, status').ilike('title', pattern).limit(PER_MODULE),
        supabase.from('accounts').select('id, name, status').eq('record_type', 'sales').ilike('name', pattern).limit(PER_MODULE),
        supabase
          .from('contacts')
          .select('id, name, email, company')
          .or(`name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`)
          .limit(PER_MODULE),
        supabase.from('deals').select('id, name, stage').ilike('name', pattern).limit(PER_MODULE),
        supabase
          .from('invoices')
          .select('id, invoice_number, status')
          .ilike('invoice_number', pattern)
          .limit(PER_MODULE),
        supabase
          .from('quotes')
          .select('id, quote_number, title, status')
          .or(`quote_number.ilike.${pattern},title.ilike.${pattern}`)
          .limit(PER_MODULE),
        supabase.from('projects').select('id, name, status').ilike('name', pattern).limit(PER_MODULE),
        supabase
          .from('engagements')
          .select('id, name, status')
          .ilike('name', pattern)
          .limit(PER_MODULE),
      ])

    const results: SearchHit[] = [
      ...(tasks.data ?? []).map((t) => ({
        id: t.id, label: t.title, sub: t.status ?? null, module: 'Tasks', href: `/my-work/${t.id}`,
      })),
      ...(deals.data ?? []).map((d) => ({
        id: d.id, label: d.name, sub: d.stage ?? null, module: 'Deals', href: `/deals?deal=${d.id}`,
      })),
      ...(accounts.data ?? []).map((a) => ({
        id: a.id, label: a.name, sub: a.status ?? null, module: 'Accounts', href: `/crm/accounts/${a.id}`,
      })),
      ...(contacts.data ?? []).map((c) => ({
        id: c.id, label: c.name, sub: c.company ?? c.email ?? null, module: 'Contacts', href: `/crm/contacts/${c.id}`,
      })),
      ...(invoices.data ?? []).map((i) => ({
        id: i.id, label: i.invoice_number, sub: i.status ?? null, module: 'Invoices', href: `/invoicing/${i.id}`,
      })),
      ...(quotes.data ?? []).map((qt) => ({
        id: qt.id, label: qt.title || qt.quote_number, sub: qt.status ?? null, module: 'Quotes', href: `/quotes/${qt.id}`,
      })),
      ...(projects.data ?? []).map((p) => ({
        id: p.id, label: p.name, sub: p.status ?? null, module: 'Projects', href: `/projects/${p.id}`,
      })),
      ...(engagements.data ?? []).map((e) => ({
        id: e.id, label: e.name, sub: e.status ?? null, module: 'Engagements', href: `/engagements/${e.id}`,
      })),
    ]

    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
