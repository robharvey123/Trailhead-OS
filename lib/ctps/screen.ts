import type { SupabaseClient } from '@supabase/supabase-js'
import { isConfigured, lookupTps, normaliseUkPhone, type CtpsLookupResult } from './datasoap'

/**
 * CTPS/TPS screening: look numbers up with Data Soap, write the result to
 * contacts.ctps_registered / ctps_checked_at, and record every paid lookup in
 * ctps_checks (migration 20261027100000). contact_call_eligibility then decides
 * who is callable; nothing here changes that rule.
 *
 * Pass the service-role client. contacts_sales_guard (migration
 * 20261024100000) refuses ctps_* changes when is_sales() is true; is_sales() is
 * false for the service role, so these writes pass the guard, and ctps_checks
 * has no RLS policies at all (service role only).
 *
 * A failed lookup leaves the contact untouched: unscreened is uncallable, which
 * is the safe state. The next nightly run picks it up again.
 */

export type ScreenSource = 'cron' | 'create' | 'import' | 'manual' | 'mcp'

export interface ScreenSummary {
  /** Contacts a lookup was issued for (deduped numbers count once per contact sharing them). */
  attempted: number
  clear: number
  registered: number
  failed: number
  /** No phone, not a UK number, or not reached because the run stopped. */
  skipped: number
  creditsUsed: number
  /**
   * insufficient_credit: Data Soap -98. provider_rejected: -99 (token) or -92
   * (unverified account over limit); every further lookup would fail the same way.
   */
  stoppedReason: 'insufficient_credit' | 'provider_rejected' | 'not_configured' | null
}

const CONCURRENCY = 5
const CHUNK = 200
const STOP_CODES: ReadonlyMap<number, 'insufficient_credit' | 'provider_rejected'> = new Map([
  [-98, 'insufficient_credit'],
  [-99, 'provider_rejected'],
  [-92, 'provider_rejected'],
])

interface ContactPhone {
  id: string
  phone: string
}

function emptySummary(): ScreenSummary {
  return { attempted: 0, clear: 0, registered: 0, failed: 0, skipped: 0, creditsUsed: 0, stoppedReason: null }
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function pool<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
}

/** Screen the given contacts. Each distinct number is looked up (and billed) once per run. */
export async function screenContacts(
  supabase: SupabaseClient,
  contactIds: readonly string[],
  source: ScreenSource,
): Promise<ScreenSummary> {
  const summary = emptySummary()
  if (!isConfigured()) return { ...summary, stoppedReason: 'not_configured' }

  const ids = Array.from(new Set(contactIds))
  const rows: Array<{ id: string; phone: string | null }> = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from('contacts').select('id, phone').in('id', ids.slice(i, i + CHUNK))
    if (error) throw new Error(`could not load contacts to screen: ${error.message}`)
    rows.push(...((data ?? []) as Array<{ id: string; phone: string | null }>))
  }

  // Group by normalised number so a shared number (e.g. a switchboard) is billed once.
  const groups = new Map<string, ContactPhone[]>()
  for (const row of rows) {
    const phone = row.phone?.trim()
    const normalised = phone ? normaliseUkPhone(phone) : null
    if (!phone || !normalised) {
      summary.skipped++
      continue
    }
    const group = groups.get(normalised) ?? []
    group.push({ id: row.id, phone: row.phone as string })
    groups.set(normalised, group)
  }

  let stopped = false
  await pool(Array.from(groups.values()), CONCURRENCY, async (contacts) => {
    if (stopped) {
      summary.skipped += contacts.length
      return
    }
    const result = await lookupTps(contacts[0].phone)
    summary.attempted += contacts.length
    if (result.ok && result.creditsUsed !== null) summary.creditsUsed += result.creditsUsed

    if (!result.ok) {
      summary.failed += contacts.length
      const stop = result.code !== null ? STOP_CODES.get(result.code) : undefined
      if (stop) {
        stopped = true
        summary.stoppedReason ??= stop
      }
      await recordChecks(supabase, contacts, result, source)
      return
    }

    // Evidence first: no audit row, no screened contact.
    if (!(await recordChecks(supabase, contacts, result, source))) {
      summary.failed += contacts.length
      return
    }

    const registered = result.tps || result.ctps
    const checkedAt = new Date().toISOString()
    for (const contact of contacts) {
      // Only write when the number is still the one we looked up: a phone
      // edited mid-run must stay unscreened (the reset trigger nulls it).
      const { data, error } = await supabase
        .from('contacts')
        .update({ ctps_registered: registered, ctps_checked_at: checkedAt })
        .eq('id', contact.id)
        .eq('phone', contact.phone)
        .select('id')
      if (error || !data || data.length === 0) {
        if (error) console.error(`[ctps] update failed for contact ${contact.id}: ${error.message}`)
        summary.failed++
      } else if (registered) {
        summary.registered++
      } else {
        summary.clear++
      }
    }
  })

  return summary
}

/**
 * One ctps_checks row per contact the lookup applied to. The lookup was billed
 * once, so credits_used sits on the first row and the rest carry 0.
 */
async function recordChecks(
  supabase: SupabaseClient,
  contacts: readonly ContactPhone[],
  result: CtpsLookupResult,
  source: ScreenSource,
): Promise<boolean> {
  const rows = contacts.map((contact, i) => ({
    contact_id: contact.id,
    phone_raw: contact.phone,
    phone_normalised: result.phoneNormalised,
    tps: result.ok ? result.tps : null,
    ctps: result.ok ? result.ctps : null,
    credits_used: result.ok ? (i === 0 ? result.creditsUsed : 0) : null,
    error_code: result.ok ? null : result.code,
    error_message: result.ok ? null : result.message,
    source,
  }))
  const { error } = await supabase.from('ctps_checks').insert(rows)
  if (error) console.error(`[ctps] audit insert failed (${rows.length} rows): ${error.message}`)
  return !error
}

/** Screen whoever contacts_needing_ctps lists, never-screened first. */
export async function screenDueContacts(
  supabase: SupabaseClient,
  opts: { limit?: number; source: ScreenSource },
): Promise<ScreenSummary> {
  if (!isConfigured()) return { ...emptySummary(), stoppedReason: 'not_configured' }
  const { data, error } = await supabase
    .from('contacts_needing_ctps')
    .select('id')
    .order('ctps_checked_at', { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? 500)
  if (error) throw new Error(`could not read contacts_needing_ctps: ${error.message}`)
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
  if (ids.length === 0) return emptySummary()
  return screenContacts(supabase, ids, opts.source)
}
