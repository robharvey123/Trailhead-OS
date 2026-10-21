/**
 * Propose size_rank (1 to 4) for sales-list contacts from their free-text
 * size_signal, for Rob to check before applying.
 *
 *   npx tsx scripts/size-rank-propose.ts            # writes data/size-rank-proposals.csv (gitignored)
 *   npx tsx scripts/size-rank-propose.ts --apply    # writes size_rank where a band was found
 *
 * Bands: 1 = under 10 people, 2 = 10 to 24, 3 = 25 to 49, 4 = 50 or more.
 * A headcount in the text wins ("over 50 engineers", "team of over 70 people",
 * "49 employees", "~15 named staff"); failing that, an ECA turnover band of
 * GBP 500k-5m reads as 2. No signal leaves size_rank empty, which sorts last
 * in the queue. Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv(filePath: string) {
  try {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const key = t.slice(0, eq).trim()
      let value = t.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

const PEOPLE = '(?:engineers?|employees?|staff|people|operatives|technicians|electricians|workforce|team members?)'

/** The largest headcount the text states about people, or null. */
export function headcountFrom(text: string): number | null {
  const t = text.toLowerCase()
  const counts: number[] = []
  const patterns = [
    new RegExp(`(\\d{1,4})\\s*\\+?\\s*(?:full[- ]time\\s+|named\\s+|in-house\\s+|directly employed\\s+|skilled\\s+|qualified\\s+)*${PEOPLE}`, 'g'),
    new RegExp(`(?:team|workforce|total) of (?:over |around |about |close to |some )?(\\d{1,4})`, 'g'),
    new RegExp(`(?:over|in excess of|more than|close to|around|about|~)\\s*(\\d{1,4})\\s*(?:skilled\\s+|full[- ]time\\s+|named\\s+)*${PEOPLE}`, 'g'),
    /employs?\s+(?:in excess of\s+|over\s+|close to\s+|around\s+)?(\d{1,4})/g,
    /(\d{1,3})\s*-\s*(\d{1,3})\s*engineers/g,
  ]
  for (const re of patterns) {
    for (const m of t.matchAll(re)) {
      const n = Number(m[2] ?? m[1])
      if (Number.isFinite(n) && n > 0 && n < 5000) counts.push(n)
    }
  }
  // "years experience" numbers are not headcount
  return counts.length ? Math.max(...counts) : null
}

export function bandFor(signal: string | null): { rank: number | null; basis: string } {
  if (!signal) return { rank: null, basis: 'no size signal' }
  const n = headcountFrom(signal)
  if (n != null) return { rank: n >= 50 ? 4 : n >= 25 ? 3 : n >= 10 ? 2 : 1, basis: `headcount ${n}` }
  if (/500k\s*-\s*5m/i.test(signal)) return { rank: 2, basis: 'ECA turnover GBP 500k-5m' }
  return { rank: null, basis: 'no headcount stated' }
}

async function main() {
  loadEnv(resolve(process.cwd(), '.env.local'))
  const apply = process.argv.includes('--apply')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data: prefixes } = await db.from('sales_scope_tag_prefixes').select('prefix')
  const pre = (prefixes ?? []).map((p) => String(p.prefix).toLowerCase())
  const { data, error } = await db.from('contacts').select('id, company, size_signal, size_rank, tags').is('merged_into', null)
  if (error) throw new Error(error.message)
  const rows = (data ?? []).filter((c) => (c.tags as string[] | null)?.some((t) => pre.some((p) => t.toLowerCase().startsWith(p))))

  const out = rows.map((c) => ({ ...c, ...bandFor(c.size_signal as string | null) }))
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  mkdirSync(resolve(process.cwd(), 'data'), { recursive: true })
  const file = resolve(process.cwd(), 'data/size-rank-proposals.csv')
  writeFileSync(file, ['id,company,proposed_rank,basis,size_signal', ...out.map((r) => [r.id, r.company, r.rank ?? '', r.basis, r.size_signal].map(esc).join(','))].join('\n') + '\n')
  const counts = [1, 2, 3, 4].map((b) => `${b}: ${out.filter((r) => r.rank === b).length}`).join(', ')
  console.log(`${out.length} contacts. Proposed bands ${counts}, unknown: ${out.filter((r) => r.rank == null).length}.`)
  console.log(`Wrote ${file}`)
  if (!apply) return
  let n = 0
  for (const r of out) {
    if (r.rank == null || r.rank === r.size_rank) continue
    const { error: e } = await db.from('contacts').update({ size_rank: r.rank }).eq('id', r.id)
    if (!e) n++
  }
  console.log(`Applied size_rank to ${n} contacts.`)
}

if (process.argv[1]?.includes('size-rank-propose')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
