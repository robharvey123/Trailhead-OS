/**
 * Unit tests for the pure quote functions in lib/cowork-quotes.ts: the `items`
 * convenience parser, the strict line-item / scope parsers, and formatQuote.
 * No network, no database. Supabase env vars are stubbed (unroutable) so the
 * import cannot reach a real project even by accident.
 *
 * Run: `npm run test:cowork-quotes`. Writes nothing.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-not-a-real-key'

import type { QuoteListItem } from '../lib/types'

let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) fail++
}

function throws(fn: () => unknown, match: RegExp, status = 400): { hit: boolean; message: string } {
  try {
    fn()
    return { hit: false, message: 'did not throw' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const errStatus = (error as { status?: number }).status
    return { hit: match.test(message) && errStatus === status, message: `${errStatus} ${message}` }
  }
}

async function main() {
  const q = await import('../lib/cowork-quotes')
  const { calculateTotals } = await import('../lib/db/quotes')

  console.log('parseQuoteItems')
  const parsed = q.parseQuoteItems([
    { title: 'Quotes', description: 'Create and send quotes.', price: 1500, deliverables: ['Builder', 'PDF'], duration: '2 weeks', estimated_hours: 20 },
    { title: 'Invoices', description: 'Raise invoices from jobs.', price: 0 },
    { title: 'Reports', description: 'Monthly reports.', price: 250, qty: 3 },
  ])
  ok('one line item per item', parsed.line_items.length === 3)
  ok('one scope entry per item', parsed.scope.length === 3)
  ok('order preserved', parsed.line_items.map((l) => l.description).join() === 'Quotes,Invoices,Reports' && parsed.scope.map((s) => s.phase).join() === 'Quotes,Invoices,Reports')
  ok('line item from title/price/qty, type fixed', parsed.line_items[2].qty === 3 && parsed.line_items[2].unit_price === 250 && parsed.line_items[2].type === 'fixed')
  ok('qty defaults to 1', parsed.line_items[0].qty === 1)
  ok('each line item gets a uuid', parsed.line_items.every((l) => /^[0-9a-f-]{36}$/.test(l.id)) && new Set(parsed.line_items.map((l) => l.id)).size === 3)
  ok('scope carries description/deliverables/duration/hours', parsed.scope[0].description === 'Create and send quotes.' && parsed.scope[0].deliverables.join() === 'Builder,PDF' && parsed.scope[0].duration === '2 weeks' && parsed.scope[0].estimated_hours === 20)
  ok('scope defaults: no deliverables, duration TBC', parsed.scope[1].deliverables.length === 0 && parsed.scope[1].duration === 'TBC' && !('estimated_hours' in parsed.scope[1]))
  ok('zero price accepted', parsed.line_items[1].unit_price === 0)

  const negative = throws(() => q.parseQuoteItems([{ title: 'A', description: 'a', price: 1 }, { title: 'Bad', description: 'b', price: -5 }]), /items\[1\] \("Bad"\): price must be zero or greater/)
  ok('negative price rejected naming the row', negative.hit, negative.message)
  const negQty = throws(() => q.parseQuoteItems([{ title: 'A', description: 'a', price: 1, qty: -1 }]), /items\[0\].*qty must be greater than zero/)
  ok('negative qty rejected', negQty.hit, negQty.message)
  const noDesc = throws(() => q.parseQuoteItems([{ title: 'A', price: 1 }]), /items\[0\] \("A"\): description is required/)
  ok('missing description rejected', noDesc.hit, noDesc.message)
  const empty = throws(() => q.parseQuoteItems([]), /items must be an array with at least one row/)
  ok('empty items rejected', empty.hit, empty.message)

  console.log('parseQuoteItemFields')
  const mixed = throws(() => q.parseQuoteItemFields({ items: [{ title: 'A', description: 'a', price: 1 }], line_items: [{ description: 'x', qty: 1, unit_price: 1 }] }), /not both/)
  ok('items with line_items rejected', mixed.hit, mixed.message)
  const mixedScope = throws(() => q.parseQuoteItemFields({ items: [{ title: 'A', description: 'a', price: 1 }], scope: [] }), /not both/)
  ok('items with scope rejected', mixedScope.hit, mixedScope.message)
  const direct = q.parseQuoteItemFields({ line_items: [{ description: 'x', qty: 2, unit_price: 10, type: 'hourly' }] })
  ok('line_items alone parse, scope untouched', direct.line_items?.[0].type === 'hourly' && direct.scope === undefined)
  const badType = throws(() => q.parseQuoteLineItems([{ description: 'x', qty: 1, unit_price: 1, type: 'weekly' }]), /line_items\[0\] \("x"\): type must be one of/)
  ok('bad line item type rejected', badType.hit, badType.message)
  const negUnit = throws(() => q.parseQuoteLineItems([{ description: 'x', qty: 1, unit_price: -1 }]), /unit_price must be zero or greater/)
  ok('negative unit_price rejected', negUnit.hit, negUnit.message)
  ok('empty scope array clears scope', q.parseQuoteScope([]).length === 0)

  console.log('formatQuote')
  const row = {
    id: '11111111-1111-4111-8111-111111111111',
    quote_number: 'QT-0099',
    title: 'Test',
    status: 'draft',
    pricing_type: 'fixed',
    scope: parsed.scope,
    line_items: [...parsed.line_items, { id: 'x', description: 'Odd pence', qty: 3, unit_price: 0.335, type: 'fixed' }],
    vat_rate: 20,
    version: 1,
    ai_generated: false,
    issue_date: '2026-11-19',
    created_at: '2026-11-19T10:00:00Z',
    updated_at: '2026-11-19T10:00:00Z',
    account: { id: 'a1', name: 'Test Account' },
    workstream: { slug: 'app-dev', label: 'App development', colour: 'purple' },
    account_name: 'Test Account',
    contact_name: null,
    contact_company: null,
    totals: { subtotal: 0, vat_amount: 0, total: 0 },
  } as unknown as QuoteListItem
  const formatted = q.formatQuote(row)
  const totals = calculateTotals(row.line_items, row.vat_rate)
  ok('subtotal matches calculateTotals', formatted.subtotal === totals.subtotal, `${formatted.subtotal} vs ${totals.subtotal}`)
  ok('vat matches calculateTotals', formatted.vat === totals.vat_amount, `${formatted.vat} vs ${totals.vat_amount}`)
  ok('total matches calculateTotals', formatted.total === totals.total, `${formatted.total} vs ${totals.total}`)
  ok('line totals present', formatted.line_items[2].line_total === 750 && formatted.line_items[3].line_total === 1.01)
  ok('account / workstream slug / url shaped', formatted.account?.name === 'Test Account' && formatted.workstream === 'app-dev' && formatted.url.endsWith('/quotes/11111111-1111-4111-8111-111111111111'))
  const summary = q.formatQuoteSummary(row)
  ok('summary drops lists, adds line_item_count', !('line_items' in summary) && !('scope' in summary) && summary.line_item_count === 4)

  console.log('activity sentences')
  ok('create sentence', q.quoteCreatedSummary(formatted) === 'Created draft quote QT-0099, £2,251.01 ex VAT, 4 items, Test Account (Test)', q.quoteCreatedSummary(formatted))
  const upd = q.quoteUpdatedSummary({ ...formatted, status: 'sent' }, { status: 'draft' }, ['status', 'sent_at', 'line_items', 'scope', 'notes'])
  ok('update sentence', upd === 'Updated quote QT-0099: status draft to sent; line items and scope replaced (4 items, £2,251.01 ex VAT); notes changed', upd)
  ok('delete sentence', q.quoteDeletedSummary(formatted) === 'Deleted draft quote QT-0099, Test Account (soft delete)')

  console.log(fail === 0 ? '\nAll quote unit checks passed.' : `\n${fail} check(s) failed.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
