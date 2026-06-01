/**
 * Link unlinked contacts to accounts (populates contacts.account_id).
 *
 * Strategy, in order, per contact where account_id IS NULL:
 *   1. Company-name match: normalise contact.company and accounts.name aggressively
 *      (lowercase, strip Ltd/Limited/Plc/Co/The + '&', collapse whitespace) and link
 *      on exact normalised equality. Ambiguous normalised names (>1 account) are skipped.
 *   2. Email-domain match: contact email domain vs account website host (and account
 *      email_contact domain). Public/free domains and junk (e.g. "via website") ignored.
 *      Ambiguous domains (>1 account) are skipped.
 *   3. Otherwise left unlinked.
 *
 * Idempotent: only touches contacts with account_id IS NULL.
 *
 * Usage:
 *   npx tsx scripts/link-contacts-to-accounts.ts --dry-run   # preview, no writes
 *   npx tsx scripts/link-contacts-to-accounts.ts             # apply
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // ignore
  }
}

loadEnv(resolve(process.cwd(), '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Free / public email providers — never used for domain-based account matching.
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'btinternet.com',
  'live.co.uk', 'live.com', 'aol.com',
])

// Words stripped from company names before matching.
const COMPANY_STOPWORDS = new Set(['ltd', 'limited', 'plc', 'co', 'the'])

function normCompany(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !COMPANY_STOPWORDS.has(w))
    .join(' ')
    .trim()
}

function normHost(raw: string | null | undefined): string | null {
  if (!raw) return null
  let h = raw.toLowerCase().trim()
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '')
  h = h.split('/')[0].split('?')[0].trim()
  if (!h.includes('.')) return null
  return h
}

function emailDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  const e = raw.toLowerCase().trim()
  if (!e.includes('@') || /\s/.test(e)) return null // rejects "via website" and malformed
  const d = e.split('@').pop() || ''
  if (!d.includes('.')) return null
  return d.replace(/^www\./, '')
}

interface Account {
  id: string
  name: string | null
  website: string | null
  email_contact: string | null
}

interface Contact {
  id: string
  name: string | null
  company: string | null
  email: string | null
}

async function fetchAll<T>(table: string, columns: string, filter = ''): Promise<T[]> {
  const out: T[] = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    let q = supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (filter === 'unlinked') q = q.is('account_id', null)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return out
}

/** Build a normalised key -> accountId map, recording ambiguous keys to skip. */
function buildMap(pairs: Array<[string | null, string]>): Map<string, string> {
  const map = new Map<string, string>()
  const ambiguous = new Set<string>()
  for (const [key, accountId] of pairs) {
    if (!key) continue
    const existing = map.get(key)
    if (existing && existing !== accountId) {
      ambiguous.add(key)
    } else if (!existing) {
      map.set(key, accountId)
    }
  }
  for (const key of ambiguous) map.delete(key)
  return map
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(dryRun ? '— DRY RUN (no writes) —\n' : '— APPLYING —\n')

  const accounts = await fetchAll<Account>('accounts', 'id,name,website,email_contact')
  const contacts = await fetchAll<Contact>('contacts', 'id,name,company,email', 'unlinked')

  console.log(`Accounts: ${accounts.length}`)
  console.log(`Unlinked contacts: ${contacts.length}\n`)

  const byName = buildMap(accounts.map((a) => [normCompany(a.name), a.id]))

  const domainPairs: Array<[string | null, string]> = []
  for (const a of accounts) {
    const wh = normHost(a.website)
    if (wh && !PUBLIC_DOMAINS.has(wh)) domainPairs.push([wh, a.id])
    const ed = emailDomain(a.email_contact)
    if (ed && !PUBLIC_DOMAINS.has(ed)) domainPairs.push([ed, a.id])
  }
  const byDomain = buildMap(domainPairs)

  const updates: Array<{ id: string; account_id: string; method: string; via: string }> = []
  let unmatched = 0
  const unmatchedSamples: string[] = []

  for (const c of contacts) {
    const cn = normCompany(c.company)
    if (cn && byName.has(cn)) {
      updates.push({ id: c.id, account_id: byName.get(cn)!, method: 'company', via: cn })
      continue
    }
    const ed = emailDomain(c.email)
    if (ed && !PUBLIC_DOMAINS.has(ed) && byDomain.has(ed)) {
      updates.push({ id: c.id, account_id: byDomain.get(ed)!, method: 'domain', via: ed })
      continue
    }
    unmatched++
    if (unmatchedSamples.length < 15) {
      unmatchedSamples.push(`${c.name ?? '?'} | company="${c.company ?? ''}" | email="${c.email ?? ''}"`)
    }
  }

  const byCompany = updates.filter((u) => u.method === 'company').length
  const byDom = updates.filter((u) => u.method === 'domain').length

  console.log(`Would link: ${updates.length}  (company: ${byCompany}, domain: ${byDom})`)
  console.log(`Remaining unlinked: ${unmatched}\n`)
  console.log('Sample unmatched (first 15):')
  for (const s of unmatchedSamples) console.log(`  - ${s}`)
  console.log('')

  if (dryRun) {
    console.log('Dry run complete — no changes written.')
    return
  }

  let written = 0
  let failed = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('contacts')
      .update({ account_id: u.account_id })
      .eq('id', u.id)
      .is('account_id', null) // guard: never overwrite an existing link
    if (error) {
      failed++
      console.error(`  Failed ${u.id}: ${error.message}`)
    } else {
      written++
    }
  }

  console.log(`\nLinked ${written} contacts (${failed} failed). Remaining unlinked: ${unmatched}.`)
}

main().catch((err) => {
  console.error('Linker failed:', err)
  process.exit(1)
})
