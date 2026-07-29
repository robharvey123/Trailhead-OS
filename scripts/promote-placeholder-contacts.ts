/**
 * Promote placeholder "contacts" to accounts.
 *
 * The CRM was seeded so that each brand account also got a fake contact carrying
 * the *same* name (name == company). Those aren't people — they're an account
 * wearing a contact costume. This script turns each into a real account and
 * archives the fake person, moving the placeholder's `role` onto the account's
 * `target_role`. It never links a fake person to some *other* real account.
 *
 * A placeholder is a contact where company is set and
 *   crm_normalise_name(name) === crm_normalise_name(company).
 *
 * Per placeholder P:
 *   - Target account = P.account_id if set, else an existing account whose
 *     normalised name matches P.company, else a newly created account.
 *   - target_role ← P.role (only when the account has none yet).
 *   - P is linked to that account and archived (status='archived'). Never deleted.
 *
 * SAFETY: any placeholder that still has a pending/active outreach recipient row
 * is SKIPPED (archiving it mid-campaign would send from a ghost or drop a queued
 * send). Those are reported so they can be handled by hand.
 *
 * Usage:
 *   npx tsx scripts/promote-placeholder-contacts.ts            # DRY RUN (default) — no writes
 *   npx tsx scripts/promote-placeholder-contacts.ts --commit   # apply
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { crmNormaliseName } from '../lib/crm/normalise'

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const COMMIT = process.argv.includes('--commit')
const supabase = createClient(url, key, { auth: { persistSession: false } })

const LIVE_RECIPIENT_STATUSES = ['pending', 'active']

type Contact = {
  id: string
  name: string
  company: string | null
  email: string | null
  role: string | null
  status: string
  account_id: string | null
  workstream_id: string | null
  notes: string | null
  tags: string[] | null
}
type Account = { id: string; name: string; target_role: string | null }

type Plan = {
  contact: Contact
  action: 'use-existing' | 'create' | 'skip-live-campaign'
  accountId: string | null
  accountName: string
  setTargetRole: string | null // role we'd write to the account (null = leave as is)
}

async function main() {
  const [{ data: contactsData, error: cErr }, { data: accountsData, error: aErr }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, company, email, role, status, account_id, workstream_id, notes, tags')
      .neq('status', 'archived'),
    supabase.from('accounts').select('id, name, target_role'),
  ])
  if (cErr) throw cErr
  if (aErr) throw aErr

  const contacts = (contactsData ?? []) as Contact[]
  const accounts = (accountsData ?? []) as Account[]

  const accountsById = new Map(accounts.map((a) => [a.id, a]))
  // Normalised name -> accounts (may collide; we only auto-use when exactly one).
  const accountsByNorm = new Map<string, Account[]>()
  for (const a of accounts) {
    const n = crmNormaliseName(a.name)
    if (!n) continue
    ;(accountsByNorm.get(n) ?? accountsByNorm.set(n, []).get(n)!).push(a)
  }

  const isPlaceholder = (c: Contact) => {
    const n = crmNormaliseName(c.name)
    return Boolean(c.company && n && n === crmNormaliseName(c.company))
  }
  const placeholders = contacts.filter(isPlaceholder)

  // Which placeholders are locked by a running campaign?
  const live = new Set<string>()
  if (placeholders.length > 0) {
    const { data: recips, error: rErr } = await supabase
      .from('outreach_recipients')
      .select('contact_id')
      .in('contact_id', placeholders.map((p) => p.id))
      .in('status', LIVE_RECIPIENT_STATUSES)
    if (rErr) throw rErr
    for (const r of recips ?? []) live.add(r.contact_id as string)
  }

  const plans: Plan[] = placeholders.map((c) => {
    if (live.has(c.id)) {
      return { contact: c, action: 'skip-live-campaign', accountId: null, accountName: c.company ?? c.name, setTargetRole: null }
    }
    // 1. Already linked to its own account.
    if (c.account_id && accountsById.has(c.account_id)) {
      const acc = accountsById.get(c.account_id)!
      return {
        contact: c,
        action: 'use-existing',
        accountId: acc.id,
        accountName: acc.name,
        setTargetRole: c.role && !acc.target_role ? c.role : null,
      }
    }
    // 2. Existing account with the same normalised name (only if unambiguous).
    const norm = crmNormaliseName(c.company ?? c.name)
    const matches = accountsByNorm.get(norm) ?? []
    if (matches.length === 1) {
      const acc = matches[0]
      return {
        contact: c,
        action: 'use-existing',
        accountId: acc.id,
        accountName: acc.name,
        setTargetRole: c.role && !acc.target_role ? c.role : null,
      }
    }
    // 3. Create a fresh account.
    return {
      contact: c,
      action: 'create',
      accountId: null,
      accountName: (c.company || c.name).trim(),
      setTargetRole: c.role ?? null,
    }
  })

  // ---- Report ----
  const creates = plans.filter((p) => p.action === 'create')
  const reuse = plans.filter((p) => p.action === 'use-existing')
  const skips = plans.filter((p) => p.action === 'skip-live-campaign')

  console.log(`\n${COMMIT ? 'COMMIT' : 'DRY RUN'} — placeholder → account promotion`)
  console.log(`Scanned ${contacts.length} non-archived contacts, found ${placeholders.length} placeholders (name == company).\n`)
  console.log(`  ${reuse.length} will attach to an existing account and archive the placeholder`)
  console.log(`  ${creates.length} will create a new account and archive the placeholder`)
  console.log(`  ${skips.length} SKIPPED — in a running campaign\n`)

  const show = (p: Plan) => {
    const role = p.setTargetRole ? `  target_role="${p.setTargetRole}"` : ''
    console.log(`   • ${p.contact.name}${p.contact.role ? ` (${p.contact.role})` : ''} → ${p.action === 'create' ? 'NEW ' : ''}account "${p.accountName}"${role}`)
  }
  if (reuse.length) { console.log('— attach to existing —'); reuse.forEach(show) }
  if (creates.length) { console.log('\n— create new account —'); creates.forEach(show) }
  if (skips.length) { console.log('\n— skipped (running campaign) —'); skips.forEach((p) => console.log(`   • ${p.contact.name} (${p.contact.id})`)) }

  if (!COMMIT) {
    console.log('\nDry run only — nothing was written. Re-run with --commit to apply.')
    return
  }

  // ---- Apply ----
  let created = 0
  let attached = 0
  let archived = 0
  for (const p of plans) {
    if (p.action === 'skip-live-campaign') continue
    let accountId = p.accountId

    if (p.action === 'create') {
      const c = p.contact
      const { data: acc, error } = await supabase
        .from('accounts')
        .insert({
          name: p.accountName,
          workstream_id: c.workstream_id,
          status: 'prospect',
          email_contact: c.email,
          notes: c.notes,
          tags: c.tags ?? [],
          target_role: p.setTargetRole,
        })
        .select('id')
        .single()
      if (error) { console.error(`  ! create failed for ${c.name}: ${error.message}`); continue }
      accountId = acc.id
      created++
    } else if (p.setTargetRole && accountId) {
      const { error } = await supabase.from('accounts').update({ target_role: p.setTargetRole }).eq('id', accountId)
      if (error) { console.error(`  ! target_role update failed for ${p.accountName}: ${error.message}`); continue }
      attached++
    } else {
      attached++
    }

    if (!accountId) continue
    const { error: archErr } = await supabase
      .from('contacts')
      .update({ account_id: accountId, status: 'archived' })
      .eq('id', p.contact.id)
    if (archErr) { console.error(`  ! archive failed for ${p.contact.name}: ${archErr.message}`); continue }
    archived++
  }

  console.log(`\nDone. Created ${created} accounts, attached ${attached}, archived ${archived} placeholder contacts.`)
  if (skips.length) console.log(`${skips.length} left in place (running campaign).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
