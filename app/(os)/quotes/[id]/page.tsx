import { notFound } from 'next/navigation'
import QuoteDetailClient from '@/components/os/QuoteDetailClient'
import type { ClientPageData } from '@/components/os/QuoteClientPagePanel'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getProjects } from '@/lib/db/projects'
import { getQuoteById, getQuoteVersions } from '@/lib/db/quotes'
import type { QuoteFieldOptions } from '@/components/os/QuoteHeaderFields'
import { buildPublicItems } from '@/lib/quotes/projection'
import { proposalUrl, publishGateFailures } from '@/lib/quotes/publish'
import { createClient } from '@/lib/supabase/server'
import type { QuoteAcceptance, QuoteEvent } from '@/lib/types'

export const metadata = { title: 'Quote' }

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ warning?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [quote, versions, events, acceptance, accounts, contacts, projects] = await Promise.all([
    getQuoteById(id, supabase).catch(() => null),
    getQuoteVersions(id, supabase).catch(() => []),
    supabase
      .from('quote_events')
      .select('id, quote_id, type, meta, created_at')
      .eq('quote_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => (data ?? []) as QuoteEvent[]),
    supabase
      .from('quote_acceptances')
      .select('*')
      .eq('quote_id', id)
      .maybeSingle()
      .then(({ data }) => (data as QuoteAcceptance | null) ?? null),
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
  ])

  if (!quote) {
    notFound()
  }

  const items = buildPublicItems(quote.line_items ?? [], quote.scope ?? [])
  const clientPage: ClientPageData = {
    publicUrl: quote.public_token ? proposalUrl(quote.public_token) : null,
    gateFailures: publishGateFailures(quote),
    events,
    acceptance,
    itemTitles: Object.fromEntries(items.map((item) => [item.id, item.title])),
  }

  // Slim option lists for the inline header editors (no CRM payload to the client).
  const fieldOptions: QuoteFieldOptions = {
    accounts: accounts.map((a) => ({ id: a.id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name)),
    contacts: contacts
      .map((c) => ({ id: c.id, name: c.name, account_id: c.account_id ?? null, company: c.company ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    projects: projects.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)),
  }

  return (
    <QuoteDetailClient
      fieldOptions={fieldOptions}
      quote={quote}
      versions={versions}
      clientPage={clientPage}
      warning={resolvedSearchParams?.warning ?? null}
    />
  )
}
