import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { crmNormaliseName } from '@/lib/crm/normalise'
import { emailDomain, normHost, PUBLIC_DOMAINS } from '@/lib/google/autolink'
import { scoreMatch, suggestAccount, type AccountLite } from '@/lib/crm/matching'

const DUP_ACCOUNT_THRESHOLD = 0.85

type ContactRow = {
  id: string
  name: string
  company: string | null
  email: string | null
  account_id: string | null
  link_skipped_at: string | null
}

/** A "placeholder" contact: an account wearing a contact costume (name == company). */
function isPlaceholder(c: ContactRow): boolean {
  const n = crmNormaliseName(c.name)
  return Boolean(c.company && n && n === crmNormaliseName(c.company))
}

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  const supabase = auth.supabase

  const [{ data: accData }, { data: conData }] = await Promise.all([
    supabase.from('accounts').select('id, name, website, email_contact').eq('record_type', 'sales'),
    supabase.from('contacts').select('id, name, company, email, account_id, link_skipped_at'),
  ])
  const accounts = (accData ?? []) as AccountLite[]
  const contacts = (conData ?? []) as ContactRow[]

  // Unlinked contacts (excluding placeholders → those go to the Phase 4 flow, and
  // excluding skipped ones), each with its top account suggestions.
  const placeholders = contacts.filter((c) => !c.account_id && isPlaceholder(c))
  const unlinked_contacts = contacts
    .filter((c) => !c.account_id && !c.link_skipped_at && !isPlaceholder(c))
    .map((c) => ({
      contact: { id: c.id, name: c.name, company: c.company, email: c.email },
      suggestions: suggestAccount({ name: c.name, company: c.company, email: c.email }, accounts),
    }))
    .sort((a, b) => (b.suggestions[0]?.score ?? 0) - (a.suggestions[0]?.score ?? 0))

  // Duplicate account pairs (near-identical names, e.g. "Twinroll AB" / "Twinroll").
  const account_duplicates: Array<{ a: AccountLite; b: AccountLite; score: number }> = []
  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      const s = scoreMatch(accounts[i].name, accounts[j].name)
      if (s >= DUP_ACCOUNT_THRESHOLD) account_duplicates.push({ a: accounts[i], b: accounts[j], score: s })
    }
  }
  account_duplicates.sort((x, y) => y.score - x.score)

  // Duplicate contact pairs — same normalised name or same email.
  const byName = new Map<string, ContactRow[]>()
  const byEmail = new Map<string, ContactRow[]>()
  for (const c of contacts) {
    const n = crmNormaliseName(c.name)
    if (n) (byName.get(n) ?? byName.set(n, []).get(n)!).push(c)
    const e = c.email?.trim().toLowerCase()
    if (e && e !== 'via website') (byEmail.get(e) ?? byEmail.set(e, []).get(e)!).push(c)
  }
  const seenPair = new Set<string>()
  const contact_duplicates: Array<{ a: ContactRow; b: ContactRow; reason: 'name' | 'email' }> = []
  const addPairs = (groups: Map<string, ContactRow[]>, reason: 'name' | 'email') => {
    for (const list of groups.values()) {
      if (list.length < 2) continue
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const key = [list[i].id, list[j].id].sort().join(':')
          if (seenPair.has(key)) continue
          seenPair.add(key)
          contact_duplicates.push({ a: list[i], b: list[j], reason })
        }
    }
  }
  addPairs(byName, 'name')
  addPairs(byEmail, 'email')

  // Unmatched inbox threads — one row per thread, suggested account by sender domain.
  const { data: threadsData } = await supabase
    .from('email_threads')
    .select('gmail_thread_id, subject, from_address, received_at')
    .is('account_id', null)
    .order('received_at', { ascending: false })
    .limit(200)
  const seenThread = new Set<string>()
  const unmatched_threads = (threadsData ?? [])
    .filter((t) => {
      if (seenThread.has(t.gmail_thread_id)) return false
      seenThread.add(t.gmail_thread_id)
      return true
    })
    .slice(0, 50)
    .map((t) => {
      const dom = emailDomain(t.from_address ?? '')
      const usable = dom && !PUBLIC_DOMAINS.has(dom) ? dom : null
      const match = usable
        ? accounts.find((a) => (normHost(a.website ?? null) || (a.email_contact ? emailDomain(a.email_contact) : null)) === usable)
        : null
      return { gmail_thread_id: t.gmail_thread_id, subject: t.subject, from_address: t.from_address, suggestion: match ? { id: match.id, name: match.name } : null }
    })

  return NextResponse.json({
    unlinked_contacts,
    account_duplicates: account_duplicates.slice(0, 50),
    contact_duplicates: contact_duplicates.slice(0, 50),
    unmatched_threads,
    placeholders_count: placeholders.length,
  })
}

// POST { contact_id, action: 'skip' } — persist a skip so the row stops suggesting.
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const contactId = typeof body.contact_id === 'string' ? body.contact_id : ''
  if (!contactId || body.action !== 'skip') {
    return NextResponse.json({ error: 'contact_id and action:"skip" required' }, { status: 400 })
  }
  const { error } = await auth.supabase.from('contacts').update({ link_skipped_at: new Date().toISOString() }).eq('id', contactId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
