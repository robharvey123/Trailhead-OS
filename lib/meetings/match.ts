// Source-agnostic meeting → CRM matcher. Deliberately free of any Google imports:
// it takes plain attendee emails plus the CRM rows it needs, so a Granola (or any)
// normaliser can feed the exact same function. Surfaces unmatched/ambiguous cases
// via `confidence` + `needsReview` rather than silently mis-filing.

import { DEAL_PIPELINE_STAGES, type Account, type Contact, type Deal, type DealStage } from '@/lib/types'

/** Our own Workspace domain(s) — never used to match an external account. */
export const OWN_DOMAINS = new Set(['trailheadholdings.uk'])

/** Free / public mail providers — never used for domain → account matching. */
export const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.co.uk',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'btinternet.com', 'live.co.uk', 'live.com',
  'aol.com', 'protonmail.com', 'proton.me',
])

function domainOf(email: string): string | null {
  const e = email.trim().toLowerCase()
  if (!e.includes('@') || /\s/.test(e)) return null
  const d = e.split('@').pop() || ''
  return d.includes('.') ? d.replace(/^www\./, '') : null
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  const h = url.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].trim()
  return h.includes('.') ? h : null
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none'

export interface MeetingLinkSet {
  accountId: string | null
  contactIds: string[]
  dealId: string | null
  confidence: MatchConfidence
  /** True whenever the link set is anything less than a clean, unambiguous resolve. */
  needsReview: boolean
}

export interface MatchInput {
  attendeeEmails: string[]
  accounts: Pick<Account, 'id' | 'website' | 'email_contact'>[]
  contacts: Pick<Contact, 'id' | 'email' | 'account_id'>[]
  deals: Pick<Deal, 'id' | 'account_id' | 'stage' | 'updated_at'>[]
}

export function matchMeeting(input: MatchInput): MeetingLinkSet {
  // External counterparties only — drop our own domain.
  const external = input.attendeeEmails
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .filter((e) => {
      const d = domainOf(e)
      return d != null && !OWN_DOMAINS.has(d)
    })

  // 1. Contacts — exact email match.
  const contactByEmail = new Map<string, { id: string; account_id: string | null }>()
  for (const c of input.contacts) {
    const e = c.email?.trim().toLowerCase()
    if (e) contactByEmail.set(e, { id: c.id, account_id: c.account_id })
  }
  const matched = external
    .map((e) => contactByEmail.get(e))
    .filter((x): x is { id: string; account_id: string | null } => Boolean(x))
  const contactIds = Array.from(new Set(matched.map((c) => c.id)))

  // 2. Account — prefer the account a matched contact already belongs to; else
  //    resolve by attendee email domain (unambiguous, skipping own + free-mail).
  let accountId: string | null = null
  let accountAmbiguous = false
  const contactAccountIds = Array.from(new Set(matched.map((c) => c.account_id).filter((x): x is string => Boolean(x))))
  if (contactAccountIds.length === 1) {
    accountId = contactAccountIds[0]
  } else if (contactAccountIds.length > 1) {
    accountId = contactAccountIds[0]
    accountAmbiguous = true
  } else {
    const accountsByDomain = new Map<string, Set<string>>()
    const add = (domain: string | null, id: string) => {
      if (!domain || OWN_DOMAINS.has(domain) || FREE_MAIL_DOMAINS.has(domain)) return
      ;(accountsByDomain.get(domain) ?? accountsByDomain.set(domain, new Set()).get(domain)!).add(id)
    }
    for (const a of input.accounts) {
      add(hostOf(a.website), a.id)
      add(domainOf(a.email_contact ?? ''), a.id)
    }
    for (const e of external) {
      const d = domainOf(e)
      if (!d || FREE_MAIL_DOMAINS.has(d)) continue
      const ids = accountsByDomain.get(d)
      if (!ids) continue
      if (ids.size === 1) { accountId = [...ids][0]; break }
      accountAmbiguous = true // domain maps to >1 account
    }
  }

  // 3. Deal — open deal on the account, most recently active; >1 flags review.
  let dealId: string | null = null
  let dealAmbiguous = false
  if (accountId) {
    const open = input.deals
      .filter((d) => d.account_id === accountId && (DEAL_PIPELINE_STAGES as DealStage[]).includes(d.stage))
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    if (open.length > 0) dealId = open[0].id
    if (open.length > 1) dealAmbiguous = true
  }

  // Confidence: high only when account + contact resolve cleanly with no ambiguity.
  const hasAccount = accountId != null
  const hasContact = contactIds.length > 0
  let confidence: MatchConfidence
  if (!hasAccount && !hasContact) confidence = 'none'
  else if (hasAccount && hasContact && !accountAmbiguous && !dealAmbiguous) confidence = 'high'
  else if (hasAccount) confidence = 'medium'
  else confidence = 'low'

  return { accountId, contactIds, dealId, confidence, needsReview: confidence !== 'high' }
}
