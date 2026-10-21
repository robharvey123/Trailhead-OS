/**
 * CTPS screening round-trip for the Engineer OS call list.
 *
 *   1. Export (read-only):
 *        npx tsx scripts/export-ctps-screening.ts export
 *      Writes, under data/ctps/ (gitignored, never commit):
 *        ctps-screening-request.csv  ref, phone_national, phone_e164, company
 *                                    -> upload this to the screening service
 *        ctps-import-template.csv    importer-ready rows with blank
 *                                    ctps_registered / ctps_checked_at
 *      Rows: every active campaign recipient (outreach_recipients.status is not
 *      'stopped') plus the reserve CSV (default
 *      data/engineer_os_outreach_contacts_reserve_11.csv). Reserves are not in
 *      the DB yet, so their template rows carry all fields and import as new
 *      contacts.
 *
 *   2. Merge the service's results into the template (local files only):
 *        npx tsx scripts/export-ctps-screening.ts merge --results <file.csv> --date YYYY-MM-DD
 *      The results file needs a `ref` or `phone` column and one result column
 *      (ctps_registered, registered, ctps, tps, result or status). Values like
 *      true/yes/registered/listed/ctps mean registered; false/no/clear/not
 *      registered/clean mean clear. --date is the screening date (default
 *      today). Writes data/ctps/ctps-import-ready.csv and lists any row it
 *      could not match. Unmatched rows stay blank, so they stay uncallable.
 *
 *   3. Import data/ctps/ctps-import-ready.csv in the OS: CRM > Contacts > Import.
 *      Existing contacts (matched by email) get ONLY their two CTPS fields
 *      updated; reserves are inserted as new contacts with their result.
 *      Import once: reserves without an email can't be de-duplicated on a
 *      second import.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (export only).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const OUT_DIR = resolve(process.cwd(), 'data/ctps')
const DEFAULT_RESERVES = resolve(process.cwd(), 'data/engineer_os_outreach_contacts_reserve_11.csv')

const TEMPLATE_COLUMNS = [
  'ref', 'name', 'company', 'email', 'phone', 'role', 'city', 'country', 'channel', 'sub_trade', 'size_signal',
  'website', 'status', 'notes', 'tags', 'email_greeting', 'workstream', 'ctps_registered', 'ctps_checked_at',
] as const
type TemplateRow = Record<(typeof TEMPLATE_COLUMNS)[number], string>

// ---------------------------------------------------------------------------
// Small CSV reader/writer (RFC 4180 quoting, BOM-tolerant). No dependency.
// ---------------------------------------------------------------------------
function parseCsv(text: string): Array<Record<string, string>> {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c !== '')) rows.push(row)
  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map((h) => h.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

function toCsv(columns: readonly string[], rows: Array<Record<string, string>>): string {
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c] ?? '')).join(','))].join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// UK phone normalisation: digits only, national (0…) and E.164 (+44…).
// ---------------------------------------------------------------------------
function normaliseUkPhone(raw: string): { national: string; e164: string } | null {
  let d = raw.replace(/[^\d+]/g, '')
  if (d.startsWith('+44')) d = '0' + d.slice(3)
  else if (d.startsWith('0044')) d = '0' + d.slice(4)
  else if (d.startsWith('44') && d.length >= 12) d = '0' + d.slice(2)
  d = d.replace(/\D/g, '')
  if (!/^0\d{9,10}$/.test(d)) return null
  return { national: d, e164: '+44' + d.slice(1) }
}

function loadEnv(filePath: string) {
  try {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function blankRow(): TemplateRow {
  return Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, ''])) as TemplateRow
}

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------
async function runExport() {
  loadEnv(resolve(process.cwd(), '.env.local'))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await db
    .from('outreach_recipients')
    .select('status, contact:contacts!inner(id, name, company, email, phone, merged_into)')
    .neq('status', 'stopped')
  if (error) throw new Error(error.message)

  type Rec = { status: string; contact: { id: string; name: string; company: string | null; email: string | null; phone: string | null; merged_into: string | null } }
  const seen = new Set<string>()
  const template: TemplateRow[] = []
  const request: Array<Record<string, string>> = []
  const problems: string[] = []

  for (const r of (data ?? []) as unknown as Rec[]) {
    const c = r.contact
    if (c.merged_into || seen.has(c.id)) continue
    seen.add(c.id)
    const ref = `C-${c.id.slice(0, 8)}`
    const phone = normaliseUkPhone(c.phone ?? '')
    if (!phone) problems.push(`${ref} ${c.company ?? c.name}: phone "${c.phone ?? ''}" is not a UK number; screen by hand`)
    if (!c.email) problems.push(`${ref} ${c.company ?? c.name}: no email, so the import can't match it; update CTPS on the contact by hand`)
    request.push({ ref, phone_national: phone?.national ?? (c.phone ?? ''), phone_e164: phone?.e164 ?? '', company: c.company ?? c.name })
    template.push({ ...blankRow(), ref, name: c.name, company: c.company ?? '', email: c.email ?? '', phone: c.phone ?? '' })
  }
  const activeCount = template.length

  const reservesPath = arg('reserves') ?? DEFAULT_RESERVES
  let reserveCount = 0
  try {
    const reserves = parseCsv(readFileSync(reservesPath, 'utf-8'))
    reserves.forEach((r, idx) => {
      const ref = `R-${String(idx + 1).padStart(2, '0')}`
      const phone = normaliseUkPhone(r.phone ?? '')
      if (!phone) problems.push(`${ref} ${r.company ?? r.name}: phone "${r.phone ?? ''}" is not a UK number; screen by hand`)
      request.push({ ref, phone_national: phone?.national ?? (r.phone ?? ''), phone_e164: phone?.e164 ?? '', company: r.company ?? r.name ?? '' })
      const row = blankRow()
      for (const col of TEMPLATE_COLUMNS) if (col in r) row[col] = r[col] ?? ''
      row.ref = ref
      row.ctps_registered = ''
      row.ctps_checked_at = ''
      template.push(row)
      reserveCount++
    })
  } catch (e) {
    problems.push(`reserves file not read (${reservesPath}): ${e instanceof Error ? e.message : String(e)}`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'ctps-screening-request.csv'), toCsv(['ref', 'phone_national', 'phone_e164', 'company'], request))
  writeFileSync(resolve(OUT_DIR, 'ctps-import-template.csv'), toCsv(TEMPLATE_COLUMNS, template))

  console.log(`Active recipients: ${activeCount}. Reserves: ${reserveCount}. Total numbers: ${request.length}.`)
  console.log(`Wrote ${resolve(OUT_DIR, 'ctps-screening-request.csv')}`)
  console.log(`Wrote ${resolve(OUT_DIR, 'ctps-import-template.csv')}`)
  if (problems.length) {
    console.log(`\n${problems.length} row(s) need a look:`)
    for (const p of problems) console.log(`  - ${p}`)
  }
}

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------
const REGISTERED = new Set(['true', 'yes', 'y', '1', 'registered', 'listed', 'ctps', 'tps', 'match', 'on ctps', 'on tps'])
const CLEAR = new Set(['false', 'no', 'n', '0', 'clear', 'clean', 'not registered', 'unregistered', 'not listed', 'ok', 'callable'])

function runMerge() {
  const resultsPath = arg('results')
  if (!resultsPath) throw new Error('merge needs --results <file.csv>')
  const date = arg('date') ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date must be YYYY-MM-DD')

  const template = parseCsv(readFileSync(resolve(OUT_DIR, 'ctps-import-template.csv'), 'utf-8'))
  const results = parseCsv(readFileSync(resolve(resultsPath), 'utf-8'))
  if (results.length === 0) throw new Error('results file has no rows')

  const cols = Object.keys(results[0])
  const lower = (k: string) => cols.find((c) => c.toLowerCase() === k)
  const refCol = lower('ref')
  const phoneCol = cols.find((c) => /phone|number|telephone|tel/i.test(c))
  const resultCol = ['ctps_registered', 'registered', 'ctps', 'tps', 'result', 'status'].map(lower).find(Boolean)
  if (!refCol && !phoneCol) throw new Error(`results need a ref or phone column (found: ${cols.join(', ')})`)
  if (!resultCol) throw new Error(`results need a result column: ctps_registered, registered, ctps, tps, result or status (found: ${cols.join(', ')})`)

  const byRef = new Map<string, boolean>()
  const byPhone = new Map<string, boolean>()
  const unreadable: string[] = []
  for (const r of results) {
    const v = (r[resultCol] ?? '').toLowerCase()
    const flag = REGISTERED.has(v) ? true : CLEAR.has(v) ? false : null
    const id = (refCol && r[refCol]) || (phoneCol && r[phoneCol]) || '?'
    if (flag === null) { unreadable.push(`${id}: "${r[resultCol]}"`); continue }
    if (refCol && r[refCol]) byRef.set(r[refCol], flag)
    if (phoneCol && r[phoneCol]) {
      const p = normaliseUkPhone(r[phoneCol])
      if (p) byPhone.set(p.national, flag)
    }
  }

  let matched = 0
  const unmatched: string[] = []
  for (const row of template) {
    const p = normaliseUkPhone(row.phone ?? '')
    const flag = byRef.get(row.ref) ?? (p ? byPhone.get(p.national) : undefined)
    if (flag === undefined) {
      unmatched.push(`${row.ref} ${row.company || row.name}`)
      row.ctps_registered = ''
      row.ctps_checked_at = ''
      continue
    }
    row.ctps_registered = flag ? 'true' : 'false'
    row.ctps_checked_at = date
    matched++
  }

  const out = resolve(OUT_DIR, 'ctps-import-ready.csv')
  writeFileSync(out, toCsv(TEMPLATE_COLUMNS, template as TemplateRow[]))
  const registered = template.filter((r) => r.ctps_registered === 'true').length
  console.log(`Matched ${matched} of ${template.length} rows (${registered} registered, ${matched - registered} clear), screened ${date}.`)
  console.log(`Wrote ${out}`)
  if (unreadable.length) console.log(`\nUnreadable result values (left blank):\n  - ${unreadable.join('\n  - ')}`)
  if (unmatched.length) console.log(`\nNo result found (left blank, stays uncallable):\n  - ${unmatched.join('\n  - ')}`)
}

const mode = process.argv[2]
const run = mode === 'export' ? runExport() : mode === 'merge' ? Promise.resolve(runMerge()) : null
if (!run) {
  console.error('Usage: npx tsx scripts/export-ctps-screening.ts export [--reserves <csv>]\n       npx tsx scripts/export-ctps-screening.ts merge --results <csv> [--date YYYY-MM-DD]')
  process.exit(1)
}
run.catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
