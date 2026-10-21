/**
 * Open-tracking audit and (optional) backfill for campaign sends.
 *
 *   npx tsx scripts/resend-open-audit.ts            # read-only report
 *   npx tsx scripts/resend-open-audit.ts --apply    # write recovered opens
 *
 * For every outreach_sends row with a resend_email_id, asks Resend for the
 * email (GET /emails/{id}) and tallies `last_event`. If Resend recorded an
 * open or click that our webhook never received (webhook not subscribed to
 * email.opened / email.clicked), --apply advances the row's status and sets
 * first_opened_at / first_clicked_at.
 *
 * Resend's email object has no open timestamp, so a recovered open is dated
 * to the send's delivered_at (or sent_at): a lower bound, marked as recovered
 * in outreach_events (type 'email.opened.recovered'). If open tracking was
 * OFF on the domain, Resend never saw an open and nothing is recoverable.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * RESEND_API_KEY in the environment or .env.local. Run with Rob's approval.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  loadEnv(resolve(process.cwd(), '.env.local'))
  const apply = process.argv.includes('--apply')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !key || !resendKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY are required')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const resend = new Resend(resendKey)

  const { data: sends, error } = await db
    .from('outreach_sends')
    .select('id, resend_email_id, status, sent_at, delivered_at, first_opened_at, first_clicked_at')
    .not('resend_email_id', 'is', null)
  if (error) throw new Error(error.message)

  const tally = new Map<string, number>()
  const recoverable: Array<{ id: string; resend_email_id: string; last: string; status: string; when: string | null }> = []
  for (const s of sends ?? []) {
    const { data, error: e } = await resend.emails.get(s.resend_email_id as string)
    const last = e ? `error:${e.name ?? 'unknown'}` : String((data as { last_event?: string } | null)?.last_event ?? 'unknown')
    tally.set(last, (tally.get(last) ?? 0) + 1)
    if ((last === 'opened' || last === 'clicked') && (RANK[last] ?? 0) > (RANK[s.status as string] ?? 0)) {
      recoverable.push({ id: s.id as string, resend_email_id: s.resend_email_id as string, last, status: s.status as string, when: (s.delivered_at ?? s.sent_at) as string | null })
    }
    await sleep(550) // stay under Resend's default 2 requests/second
  }

  console.log(`Checked ${sends?.length ?? 0} campaign sends against Resend.`)
  for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  last_event ${k}: ${v}`)
  console.log(`Recoverable opens/clicks not in our data: ${recoverable.length}`)
  if (recoverable.length === 0) {
    console.log('Nothing to recover. If every last_event is "delivered", open tracking was off on the domain, so Resend has no opens to give back.')
    return
  }
  if (!apply) {
    console.log('Read-only run. Re-run with --apply (with Rob\'s approval) to write them.')
    return
  }
  for (const r of recoverable) {
    const patch: Record<string, unknown> = { status: r.last }
    if (r.when) patch.first_opened_at = r.when
    if (r.last === 'clicked' && r.when) patch.first_clicked_at = r.when
    await db.from('outreach_sends').update(patch).eq('id', r.id).is('first_opened_at', null)
    await db.from('outreach_events').insert({ send_id: r.id, resend_email_id: r.resend_email_id, type: `email.${r.last}.recovered`, payload: { source: 'resend-open-audit', approximate_time: r.when }, occurred_at: r.when ?? new Date().toISOString() })
  }
  console.log(`Applied ${recoverable.length} recovered events. Times are approximate (delivery time).`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
