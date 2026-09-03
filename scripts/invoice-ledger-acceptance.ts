/**
 * Invoice-ledger acceptance harness (invoicing v2 follow-up, Part B).
 *
 * Live-server HTTP guard against the REAL database — there is no test DB.
 * Safety rules, non-negotiable:
 *   - every row created here is named ZZ-ACCEPTANCE-<run timestamp>
 *   - cleanup deletes ONLY the ids this run created (never by name/prefix match)
 *     and runs in a `finally`; if it fails, the leftover ids are printed
 *   - COWORK_BASE must be passed explicitly — there is no default host
 *   - invoice_number_seq is captured before and restored after, so scratch
 *     invoices leave no gap in the (legally unbroken) TH- numbering. That
 *     restore is ONLY safe because Rob is the sole user and nothing issues
 *     invoices concurrently. Do not run this in a multi-user future.
 *
 * Run:
 *   COWORK_BASE=http://localhost:3939 COWORK_API_KEY=... npm run test:invoice-ledger
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (falls back to
 * .env.local) for the scratch account/contact, the webhook-replay insert and
 * the sequence peek/restore. NOT a build gate — it mutates data.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.COWORK_BASE
const KEY = process.env.COWORK_API_KEY
if (!BASE || !KEY) {
  console.error('Refusing to start: pass COWORK_BASE (no default host) and COWORK_API_KEY explicitly.')
  process.exit(2)
}

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
const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const RUN = `ZZ-ACCEPTANCE-${Date.now()}`
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
function daysAhead(n: number): string {
  return daysAgo(-n)
}

// Ids this run created — the ONLY things cleanup may touch.
const created = { accountId: '', contactId: '', invoiceIds: [] as string[] }
function assertOwn(id: string, pool: string[]) {
  if (!pool.includes(id)) {
    throw new Error(`SAFETY ABORT: cleanup asked to delete ${id}, which this run did not create`)
  }
}

async function main() {
  console.log(`Run tag: ${RUN}\nTarget:  ${BASE}\n`)

  // Sequence snapshot, restored in cleanup.
  const { data: seqBefore, error: seqErr } = await service.rpc('invoice_seq_peek')
  if (seqErr) throw new Error(`invoice_seq_peek failed (migration 20260903120000 applied?): ${seqErr.message}`)
  const seq = seqBefore as { last_value: number; is_called: boolean }
  console.log(`invoice_number_seq: last_value=${seq.last_value} is_called=${seq.is_called}\n`)

  try {
    // ── Setup ──
    const { data: account, error: accErr } = await service
      .from('accounts')
      .insert({
        name: `${RUN} Ltd`,
        record_type: 'sales',
        status: 'prospect',
        payment_terms_days: 30,
        po_required: false,
        hq_address: '12 Acacia Avenue\nBelper\nDE56 1AB',
        tags: [],
      })
      .select('id')
      .single()
    if (accErr) throw new Error(accErr.message)
    created.accountId = account.id as string

    const { data: contact, error: conErr } = await service
      .from('contacts')
      .insert({ name: `${RUN} Contact`, account_id: created.accountId, email: 'zz-acceptance@example.invalid', status: 'lead', tags: [] })
      .select('id')
      .single()
    if (conErr) throw new Error(conErr.message)
    created.contactId = contact.id as string

    // ── 1 + 2: create the main invoice through the API (no due_date given) ──
    console.log('create + derivation')
    const createRes = await api('POST', '/api/invoices', {
      account_id: created.accountId,
      contact_id: created.contactId,
      status: 'sent',
      vat_rate: 0,
      line_items: [
        { description: `${RUN} line 1`, qty: 1, unit_price: 600 },
        { description: `${RUN} line 2`, qty: 1, unit_price: 400 },
      ],
    })
    ok('invoice created', createRes.status === 201, `status ${createRes.status} ${JSON.stringify(createRes.json).slice(0, 120)}`)
    const inv = createRes.json.invoice as Record<string, unknown>
    if (!inv?.id) throw new Error('no invoice id returned; aborting')
    created.invoiceIds.push(inv.id as string)
    const issue = String(inv.issue_date)
    const expectedDue = (() => {
      const d = new Date(`${issue}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 30)
      return d.toISOString().slice(0, 10)
    })()
    ok('due date = issue + 30d (account terms, not the 14d default)', inv.due_date === expectedDue, `${inv.due_date} vs ${expectedDue}`)
    ok('bill_to_address from hq_address parse', String(inv.bill_to_address ?? '').includes('12 Acacia Avenue'), String(inv.bill_to_address))
    ok('bill_to_city parsed', inv.bill_to_city === 'Belper', String(inv.bill_to_city))
    ok('bill_to_postcode parsed', inv.bill_to_postcode === 'DE56 1AB', String(inv.bill_to_postcode))

    // Push the due date into the past for the overdue-revert assertion later.
    const patchDue = await api('PATCH', `/api/invoices/${inv.id}`, { due_date: daysAgo(25) })
    ok('due date moved into the past', patchDue.status === 200, `status ${patchDue.status}`)

    // ── 3: backdated part payment ──
    console.log('part payment')
    const p1 = await api('POST', `/api/invoices/${inv.id}/payments`, { paid_on: daysAgo(21), amount: 400, method: 'bank_transfer', reference: RUN })
    ok('£400 dated 21 days ago accepted', p1.status === 201, `status ${p1.status} ${JSON.stringify(p1.json).slice(0, 120)}`)
    const p1id = (p1.json.payment as Record<string, unknown>)?.id as string
    let ledger = await api('GET', `/api/invoices/${inv.id}/payments`)
    ok('amount_paid 400, balance 600', ledger.json.amount_paid === 400 && ledger.json.balance === 600, JSON.stringify(ledger.json).slice(0, 100))
    let invState = (await api('GET', `/api/invoices/${inv.id}`)).json.invoice as Record<string, unknown>
    ok('status part_paid', invState.status === 'part_paid', String(invState.status))
    ok('paid_at null while part paid', invState.paid_at == null, String(invState.paid_at))

    // ── 4: settling payment carries its own date ──
    console.log('settlement')
    const p2 = await api('POST', `/api/invoices/${inv.id}/payments`, { paid_on: daysAgo(3), amount: 600, method: 'bank_transfer', reference: RUN })
    ok('£600 dated 3 days ago accepted', p2.status === 201, `status ${p2.status}`)
    const p2id = (p2.json.payment as Record<string, unknown>)?.id as string
    invState = (await api('GET', `/api/invoices/${inv.id}`)).json.invoice as Record<string, unknown>
    ok('status paid', invState.status === 'paid', String(invState.status))
    ok("paid_at is the second payment's date, not today", String(invState.paid_at ?? '').slice(0, 10) === daysAgo(3), `${invState.paid_at} vs ${daysAgo(3)}`)
    ledger = await api('GET', `/api/invoices/${inv.id}/payments`)
    ok('balance 0', ledger.json.balance === 0, String(ledger.json.balance))

    // ── 5 + 6: rejections ──
    console.log('rejections')
    const over = await api('POST', `/api/invoices/${inv.id}/payments`, { paid_on: daysAgo(0), amount: 0.5 })
    ok('overpayment rejected with 400', over.status === 400, `status ${over.status}`)
    ok('error names the balance', /balance/i.test(String(over.json.error ?? '')), String(over.json.error))
    const future = await api('POST', `/api/invoices/${inv.id}/payments`, { paid_on: daysAhead(1), amount: 1 })
    ok('future-dated payment rejected with 400', future.status === 400, `status ${future.status} ${String(future.json.error ?? '')}`)

    // ── 7: deletes revert correctly ──
    console.log('delete reverts')
    const del2 = await api('DELETE', `/api/invoices/${inv.id}/payments/${p2id}`)
    ok('settling payment deleted', del2.status === 200, `status ${del2.status}`)
    invState = (await api('GET', `/api/invoices/${inv.id}`)).json.invoice as Record<string, unknown>
    ok('back to part_paid with paid_at null', invState.status === 'part_paid' && invState.paid_at == null, `${invState.status} / ${invState.paid_at}`)
    const del1 = await api('DELETE', `/api/invoices/${inv.id}/payments/${p1id}`)
    ok('first payment deleted', del1.status === 200, `status ${del1.status}`)
    invState = (await api('GET', `/api/invoices/${inv.id}`)).json.invoice as Record<string, unknown>
    ok('back to overdue (due date past), NOT sent', invState.status === 'overdue', String(invState.status))

    // ── 8: direct status writes blocked ──
    console.log('direct status writes')
    const paidPatch = await api('PATCH', `/api/invoices/${inv.id}`, { status: 'paid' })
    ok("status:'paid' rejected with 409", paidPatch.status === 409, `status ${paidPatch.status}`)
    const partPatch = await api('PATCH', `/api/invoices/${inv.id}`, { status: 'part_paid' })
    ok("status:'part_paid' rejected with 409", partPatch.status === 409, `status ${partPatch.status}`)

    // ── 9: tier rejection ──
    const tier = await api('POST', '/api/invoices', {
      account_id: created.accountId,
      pricing_tier_id: 'anything',
      line_items: [{ description: `${RUN} tier probe`, qty: 1, unit_price: 1 }],
    })
    ok('pricing_tier_id rejected with 400', tier.status === 400, `status ${tier.status}`)

    // ── 10: webhook replay idempotency (service client, assert on row count) ──
    console.log('webhook idempotency')
    const pi = `${RUN}-pi`
    const row = { invoice_id: inv.id, paid_on: daysAgo(1), amount: 100, currency: 'GBP', method: 'stripe', stripe_payment_intent_id: pi }
    const first = await service.from('invoice_payments').insert(row)
    const second = await service.from('invoice_payments').insert(row)
    const { count } = await service.from('invoice_payments').select('id', { count: 'exact', head: true }).eq('stripe_payment_intent_id', pi)
    ok('first insert lands, replay blocked, exactly one row', first.error === null && second.error !== null && count === 1, `count=${count}`)

    // ── 11: rounding — per-line rounding settles on the displayed total ──
    console.log('rounding')
    const roundRes = await api('POST', '/api/invoices', {
      account_id: created.accountId,
      status: 'sent',
      vat_rate: 20,
      line_items: [
        { description: `${RUN} r1`, qty: 1, unit_price: 33.33 },
        { description: `${RUN} r2`, qty: 1, unit_price: 33.33 },
        { description: `${RUN} r3`, qty: 1, unit_price: 33.34 },
      ],
    })
    ok('rounding invoice created', roundRes.status === 201, `status ${roundRes.status}`)
    const rInv = roundRes.json.invoice as Record<string, unknown>
    if (rInv?.id) created.invoiceIds.push(rInv.id as string)
    const rLedger = await api('GET', `/api/invoices/${rInv.id}/payments`)
    const displayedTotal = rLedger.json.total as number
    ok('displayed total is 120.00', displayedTotal === 120, String(displayedTotal))
    const rPay = await api('POST', `/api/invoices/${rInv.id}/payments`, { paid_on: daysAgo(0), amount: displayedTotal, method: 'bank_transfer' })
    ok('single payment of the displayed total accepted', rPay.status === 201, `status ${rPay.status} ${String(rPay.json.error ?? '')}`)
    const rState = (await api('GET', `/api/invoices/${rInv.id}`)).json.invoice as Record<string, unknown>
    const rBalance = (await api('GET', `/api/invoices/${rInv.id}/payments`)).json.balance
    ok('settles to zero balance and paid', rState.status === 'paid' && rBalance === 0, `${rState.status} / balance ${rBalance}`)
  } finally {
    // ── Cleanup: only what this run created, ids printed if anything fails ──
    console.log('\ncleanup')
    const leftovers: string[] = []
    for (const invoiceId of created.invoiceIds) {
      assertOwn(invoiceId, created.invoiceIds)
      const { error } = await service.from('invoices').delete().eq('id', invoiceId) // payments cascade
      if (error) leftovers.push(`invoice ${invoiceId}: ${error.message}`)
    }
    if (created.contactId) {
      assertOwn(created.contactId, [created.contactId])
      const { error } = await service.from('contacts').delete().eq('id', created.contactId)
      if (error) leftovers.push(`contact ${created.contactId}: ${error.message}`)
    }
    if (created.accountId) {
      assertOwn(created.accountId, [created.accountId])
      const { error } = await service.from('accounts').delete().eq('id', created.accountId)
      if (error) leftovers.push(`account ${created.accountId}: ${error.message}`)
    }

    // Restore the invoice-number sequence to its pre-run value.
    const { data: seqAfter } = await service.rpc('invoice_seq_peek')
    const after = seqAfter as { last_value: number; is_called: boolean } | null
    if (after && (after.last_value !== seq.last_value || after.is_called !== seq.is_called)) {
      const { error } = await service.rpc('invoice_seq_restore', { v: seq.last_value, called: seq.is_called })
      if (error) leftovers.push(`invoice_number_seq NOT restored (was ${seq.last_value}): ${error.message}`)
      else console.log(`  invoice_number_seq restored to ${seq.last_value}`)
    } else {
      console.log('  invoice_number_seq unchanged')
    }

    if (leftovers.length) {
      console.error('  CLEANUP INCOMPLETE — remove by hand:')
      for (const l of leftovers) console.error(`    ${l}`)
      fail++
    } else {
      console.log('  all scratch rows removed')
    }
  }

  console.log(`\n${fail === 0 ? '✓ INVOICE LEDGER ACCEPTANCE PASSED' : `✗ ${fail} FAILURE(S)`}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
