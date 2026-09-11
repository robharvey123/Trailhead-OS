/**
 * Time-link resolver + billing-month regression guard (unified time recording).
 *
 * Runs against the DB in .env.local with the SERVICE key. Creates a throwaway
 * ZZ-TIMELINKS-tagged account, engagement, project, task and contributor row,
 * exercises resolveTimeLinks + the time_entries_fill_links trigger + the shared
 * billing-month maths, and deletes ONLY the ids it created (in a finally).
 *
 * Run: `npm run test:time-links`. Item 8 (live cowork filter control) runs only
 * when COWORK_BASE + COWORK_API_KEY are set. NOT a build gate — it writes rows.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { resolveTimeLinks, TimeLinkConflict } from '../lib/time/links'
import { bucketByBillingMonth } from '../lib/time/summary'
import { updateTimeEntry } from '../lib/db/timesheet'
import type { TimeEntryLedgerRow } from '../lib/types'

function envFromDotLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return undefined
  const m = new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(p, 'utf8'))
  return m ? m[1].trim().replace(/^"|"$/g, '') : undefined
}
const SUPABASE_URL = envFromDotLocal('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = envFromDotLocal('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or .env.local).')
  process.exit(2)
}
const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const RUN = `ZZ-TIMELINKS-${Date.now()}`
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}

const created = { accountId: '', engagementId: '', projectId: '', taskId: '', contributor: false, entryIds: [] as string[] }

async function main() {
  console.log(`Run tag: ${RUN}\n`)

  const { data: owner } = await svc.rpc('owner_user_id')
  const { data: person } = await svc.rpc('owner_person_id')
  if (!owner || !person) throw new Error('owner_user_id / owner_person_id not resolvable')
  const ownerUserId = owner as string
  const ownerPersonId = person as string

  try {
    // ── Scratch graph: account → engagement (15th-anchored) → project → task ──
    const { data: acct, error: aErr } = await svc
      .from('accounts')
      .insert({ name: `${RUN} Ltd`, record_type: 'sales', status: 'prospect', default_hourly_rate: 90, tags: [] })
      .select('id')
      .single()
    if (aErr) throw new Error(aErr.message)
    created.accountId = acct.id as string

    const { data: eng, error: eErr } = await svc
      .from('engagements')
      .insert({
        name: `${RUN} Engagement`,
        code: RUN,
        engagement_type: 'client_consulting', // is_billable is GENERATED from the type
        status: 'Active',
        start_date: '2026-08-15',
        billing_month_start_day: 15,
        included_hours_monthly: 40,
        end_client_account_id: created.accountId,
      })
      .select('id')
      .single()
    if (eErr) throw new Error(eErr.message)
    created.engagementId = eng.id as string

    const { data: proj, error: pErr } = await svc
      .from('projects')
      .insert({ name: `${RUN} Project`, status: 'active', engagement_id: created.engagementId, account_id: created.accountId, hourly_rate: 120 })
      .select('id')
      .single()
    if (pErr) throw new Error(pErr.message)
    created.projectId = proj.id as string

    const { data: task, error: tErr } = await svc
      .from('engagement_tasks')
      .insert({ title: `${RUN} task`, engagement_id: created.engagementId, project_id: created.projectId, status: 'backlog' })
      .select('id')
      .single()
    if (tErr) throw new Error(tErr.message)
    created.taskId = task.id as string

    const { error: cErr } = await svc
      .from('engagement_contributors')
      .insert({ engagement_id: created.engagementId, person_id: ownerPersonId, hourly_rate_gbp: 175, is_active: true })
    if (cErr) throw new Error(cErr.message)
    created.contributor = true

    // ── 1. task_id alone → everything filled, contributor rate ──
    console.log('resolver')
    const r1 = await resolveTimeLinks({ task_id: created.taskId, user_id: ownerUserId }, svc)
    ok('task fills engagement + project + account + person', r1.engagement_id === created.engagementId && r1.project_id === created.projectId && r1.account_id === created.accountId && r1.person_id === ownerPersonId, JSON.stringify({ e: r1.engagement_id, p: r1.project_id, a: r1.account_id }))
    ok('contributor rate wins (175)', r1.rate_snapshot === 175 && r1.rate_source === 'contributor', `${r1.rate_snapshot} (${r1.rate_source})`)

    // ── 2. project_id alone → engagement + account from the project ──
    const r2 = await resolveTimeLinks({ project_id: created.projectId }, svc)
    ok('project fills engagement + account', r2.engagement_id === created.engagementId && r2.account_id === created.accountId)
    ok('project rate applies without a person (120)', r2.rate_snapshot === 120 && r2.rate_source === 'project', `${r2.rate_snapshot} (${r2.rate_source})`)

    // ── 3. engagement_id alone → account + billable derived ──
    const r3 = await resolveTimeLinks({ engagement_id: created.engagementId }, svc)
    ok('engagement fills account, billable from is_billable', r3.account_id === created.accountId && r3.billable === true)
    ok('account default rate is the last resort (90)', r3.rate_snapshot === 90 && r3.rate_source === 'account', `${r3.rate_snapshot} (${r3.rate_source})`)

    // ── 4. contradiction → TimeLinkConflict ──
    let threw = false
    try {
      await resolveTimeLinks({ task_id: created.taskId, engagement_id: created.accountId /* wrong uuid on purpose */ }, svc)
    } catch (e) {
      threw = e instanceof TimeLinkConflict
    }
    ok('contradicting engagement_id + task_id throws TimeLinkConflict', threw)

    // ── 5. raw SQL insert → trigger fills the same four columns ──
    console.log('trigger')
    const { data: rawRow, error: rawErr } = await svc
      .from('time_entries')
      .insert({
        user_id: ownerUserId,
        task_id: created.taskId,
        entry_date: '2026-09-01',
        duration_minutes: 30,
        description: `${RUN} raw`,
        billable: true,
        rate_snapshot: 0,
        currency_snapshot: 'GBP',
        source: 'manual',
        is_running: false,
      })
      .select('id, engagement_id, project_id, account_id, person_id')
      .single()
    if (rawErr) throw new Error(rawErr.message)
    created.entryIds.push(rawRow.id as string)
    ok(
      'trigger fills engagement + project + account + person from task alone',
      rawRow.engagement_id === created.engagementId && rawRow.project_id === created.projectId && rawRow.account_id === created.accountId && rawRow.person_id === ownerPersonId,
      JSON.stringify(rawRow)
    )

    // ── 6. billed row refuses link changes ──
    console.log('billed guard')
    await svc.from('time_entries').update({ billed: true }).eq('id', rawRow.id)
    let billedThrew = false
    try {
      await updateTimeEntry(rawRow.id as string, { project_id: null }, svc as never)
    } catch (e) {
      billedThrew = e instanceof TimeLinkConflict
    }
    ok('updateTimeEntry rejects a link change on a billed row', billedThrew)
    await svc.from('time_entries').update({ billed: false }).eq('id', rawRow.id)

    // ── 7. billing-month buckets: 15th anchor, pre-start folds into month one ──
    console.log('billing months')
    const mk = (date: string): TimeEntryLedgerRow =>
      ({ id: date, entry_date: date, duration_minutes: 60, billable: true, billed: false, rate_snapshot: 100 }) as unknown as TimeEntryLedgerRow
    const buckets = bucketByBillingMonth(
      ['2026-08-10', '2026-08-14', '2026-08-15', '2026-09-14', '2026-09-15'].map(mk),
      { start_date: '2026-08-15', billing_month_start_day: 15 }
    )
    const p1 = buckets.find((b) => b.period.start === '2026-08-15')
    const p2 = buckets.find((b) => b.period.start === '2026-09-15')
    ok('two periods only', buckets.length === 2, buckets.map((b) => b.period.start).join(', '))
    ok('[2026-08-15..2026-09-14] holds the first four (pre-start folds in)', p1?.rows.length === 4 && p1.period.end === '2026-09-14', `${p1?.rows.length} rows`)
    ok('[2026-09-15..] holds the last', p2?.rows.length === 1)
    ok('month one flagged as first', p1?.period.isFirst === true)

    // ── 8. cowork filter control (live server only) ──
    if (process.env.COWORK_BASE && process.env.COWORK_API_KEY) {
      console.log('cowork filter control')
      const res = await fetch(`${process.env.COWORK_BASE}/api/cowork/time?engagement_id=00000000-0000-0000-0000-000000000000`, {
        headers: { Authorization: `Bearer ${process.env.COWORK_API_KEY}` },
      })
      ok('garbage engagement_id still 404s (never the full table)', res.status === 404, `status ${res.status}`)
    } else {
      console.log('cowork filter control — skipped (set COWORK_BASE + COWORK_API_KEY to run)')
    }
  } finally {
    console.log('\ncleanup')
    const leftovers: string[] = []
    for (const id of created.entryIds) {
      const { error } = await svc.from('time_entries').delete().eq('id', id)
      if (error) leftovers.push(`time_entry ${id}: ${error.message}`)
    }
    if (created.contributor) {
      const { error } = await svc.from('engagement_contributors').delete().eq('engagement_id', created.engagementId).eq('person_id', ownerPersonId)
      if (error) leftovers.push(`contributor: ${error.message}`)
    }
    if (created.taskId) {
      const { error } = await svc.from('engagement_tasks').delete().eq('id', created.taskId)
      if (error) leftovers.push(`task ${created.taskId}: ${error.message}`)
    }
    if (created.projectId) {
      const { error } = await svc.from('projects').delete().eq('id', created.projectId)
      if (error) leftovers.push(`project ${created.projectId}: ${error.message}`)
    }
    if (created.engagementId) {
      const { error } = await svc.from('engagements').delete().eq('id', created.engagementId)
      if (error) leftovers.push(`engagement ${created.engagementId}: ${error.message}`)
    }
    if (created.accountId) {
      const { error } = await svc.from('accounts').delete().eq('id', created.accountId)
      if (error) leftovers.push(`account ${created.accountId}: ${error.message}`)
    }
    if (leftovers.length) {
      console.error('  CLEANUP INCOMPLETE — remove by hand:')
      for (const l of leftovers) console.error(`    ${l}`)
      fail++
    } else {
      console.log('  all scratch rows removed')
    }
  }

  console.log(`\n${fail === 0 ? '✓ TIME LINKS GUARD PASSED' : `✗ ${fail} FAILURE(S)`}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
