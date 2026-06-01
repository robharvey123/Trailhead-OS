import type { EmailMatchMethod } from '@/lib/types'

// Free / public providers — never used for domain-based account matching.
export const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'btinternet.com',
  'live.co.uk', 'live.com', 'aol.com',
])

/** Extract a clean lowercase email address from a header value like `Name <a@b.com>`. */
export function parseAddress(raw?: string | null): { name: string | null; email: string } {
  if (!raw) return { name: null, email: '' }
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() }
  return { name: null, email: raw.trim().toLowerCase() }
}

/** Split a comma-separated header (To/Cc) into clean lowercase emails. */
export function parseAddressList(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((p) => parseAddress(p).email)
    .filter(Boolean)
}

export function emailDomain(email: string): string | null {
  const e = email.trim().toLowerCase()
  if (!e.includes('@') || /\s/.test(e)) return null
  const d = e.split('@').pop() || ''
  if (!d.includes('.')) return null
  return d.replace(/^www\./, '')
}

export function normHost(url: string | null | undefined): string | null {
  if (!url) return null
  let h = url.toLowerCase().trim()
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].trim()
  return h.includes('.') ? h : null
}

export interface AutolinkMaps {
  contactByEmail: Map<string, { account_id: string | null; contact_id: string }>
  accountByDomain: Map<string, string>
  selfEmails: Set<string>
}

export function buildAutolinkMaps(
  contacts: Array<{ id: string; email: string | null; account_id: string | null }>,
  accounts: Array<{ id: string; website: string | null; email_contact: string | null }>,
  selfEmails: string[]
): AutolinkMaps {
  const contactByEmail = new Map<string, { account_id: string | null; contact_id: string }>()
  for (const c of contacts) {
    const e = c.email?.trim().toLowerCase()
    if (e) contactByEmail.set(e, { account_id: c.account_id, contact_id: c.id })
  }

  // domain -> account, dropping ambiguous domains (>1 account)
  const domainAccounts = new Map<string, Set<string>>()
  const add = (domain: string | null, id: string) => {
    if (!domain || PUBLIC_DOMAINS.has(domain)) return
    ;(domainAccounts.get(domain) ?? domainAccounts.set(domain, new Set()).get(domain)!).add(id)
  }
  for (const a of accounts) {
    add(normHost(a.website), a.id)
    add(emailDomain(a.email_contact ?? ''), a.id)
  }
  const accountByDomain = new Map<string, string>()
  for (const [domain, ids] of domainAccounts) {
    if (ids.size === 1) accountByDomain.set(domain, [...ids][0])
  }

  return { contactByEmail, accountByDomain, selfEmails: new Set(selfEmails.map((e) => e.toLowerCase())) }
}

export interface LinkResult {
  account_id: string | null
  contact_id: string | null
  method: EmailMatchMethod
}

/**
 * Determine the account/contact a message belongs to.
 * Order: contact-email match → domain match → unmatched.
 * `participants` is every from/to/cc address on the message.
 */
export function determineLink(participants: string[], maps: AutolinkMaps): LinkResult {
  const counterparties = participants
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && !maps.selfEmails.has(e))

  // 1. contact email
  for (const e of counterparties) {
    const hit = maps.contactByEmail.get(e)
    if (hit) return { account_id: hit.account_id, contact_id: hit.contact_id, method: 'contact_email' }
  }

  // 2. domain (unambiguous)
  for (const e of counterparties) {
    const d = emailDomain(e)
    if (d && maps.accountByDomain.has(d)) {
      return { account_id: maps.accountByDomain.get(d)!, contact_id: null, method: 'domain' }
    }
  }

  return { account_id: null, contact_id: null, method: 'unmatched' }
}
