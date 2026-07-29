import { crmNormaliseName } from './normalise'
import { PUBLIC_DOMAINS, emailDomain, normHost } from '@/lib/google/autolink'

export interface AccountLite {
  id: string
  name: string
  website?: string | null
  email_contact?: string | null
}

export type MatchReason = 'exact' | 'normalised' | 'domain' | 'fuzzy'
export interface AccountSuggestion {
  account: AccountLite
  score: number
  reason: MatchReason
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

/** Dice bigram similarity on normalised names, 0-1 (1 = normalised-equal). */
export function scoreMatch(a: string, b: string): number {
  const x = crmNormaliseName(a)
  const y = crmNormaliseName(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const A = bigrams(x)
  const B = bigrams(y)
  let inter = 0
  let total = 0
  for (const [g, c] of A) {
    total += c
    const bc = B.get(g)
    if (bc) inter += Math.min(c, bc)
  }
  for (const c of B.values()) total += c
  return total ? (2 * inter) / total : 0
}

function accountDomain(a: AccountLite): string | null {
  return normHost(a.website ?? null) || (a.email_contact ? emailDomain(a.email_contact) : null)
}

/**
 * Suggest accounts for a contact/import row. Priority: exact name → normalised
 * name → email/website domain equals the account's domain → fuzzy ≥ 0.8. Reuses
 * PUBLIC_DOMAINS so a gmail address never matches by domain. Top 3, best first.
 */
export function suggestAccount(
  input: { name?: string | null; company?: string | null; email?: string | null; website?: string | null },
  accounts: AccountLite[]
): AccountSuggestion[] {
  const candidate = (input.company || input.name || '').trim()
  const rawDomain = input.email ? emailDomain(input.email) : normHost(input.website ?? null)
  const usableDomain = rawDomain && !PUBLIC_DOMAINS.has(rawDomain) ? rawDomain : null
  const candidateNorm = crmNormaliseName(candidate)

  const out: AccountSuggestion[] = []
  for (const a of accounts) {
    if (candidate && a.name.trim().toLowerCase() === candidate.toLowerCase()) {
      out.push({ account: a, score: 1, reason: 'exact' })
      continue
    }
    if (candidateNorm && crmNormaliseName(a.name) === candidateNorm) {
      out.push({ account: a, score: 0.97, reason: 'normalised' })
      continue
    }
    if (usableDomain && accountDomain(a) === usableDomain) {
      out.push({ account: a, score: 0.9, reason: 'domain' })
      continue
    }
    if (candidate) {
      const s = scoreMatch(candidate, a.name)
      if (s >= 0.8) out.push({ account: a, score: s, reason: 'fuzzy' })
    }
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 3)
}
