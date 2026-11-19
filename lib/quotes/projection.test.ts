import { describe, expect, it } from 'vitest'
import { buildPublicQuote, cleanItemTitle, isProposalToken, londonToday, proposalState, type ProposalRow } from '@/lib/quotes/projection'
import { initialSelection, parseSelection, selectionTotals } from '@/lib/quotes/selection'

// The exact key sets the public projection may carry. Adding a field to
// PublicQuote must be a deliberate edit here.
const QUOTE_KEYS = [
  'acceptance', 'company', 'client_notes', 'estimated_timeline', 'issue_date', 'items', 'payment_terms',
  'prepared_for', 'quote_number', 'state', 'summary', 'title', 'updated_at', 'valid_until', 'vat_rate', 'version',
].sort()
const ITEM_KEYS = [
  'default_selected', 'deliverables', 'detail', 'duration', 'id', 'included', 'line_total', 'optional', 'qty',
  'title', 'unit_price',
].sort()

const CANARY = 'LEAK-CANARY-123'

// A row as loaded, plus every internal field the DB holds, to prove the builder
// ignores what it was not told to read.
const row = {
  quote_number: 'QT-0099',
  status: 'sent',
  title: 'Field app',
  summary: 'What we talked about.',
  issue_date: '2026-11-19',
  valid_until: '2099-12-19',
  estimated_timeline: '6 weeks',
  line_items: [
    { id: 'a', description: '1. Quotes', qty: 1, unit_price: 500, type: 'fixed', optional: true, detail: 'Send quotes.' },
    { id: 'b', description: '2. Jobs', qty: 1, unit_price: 500, type: 'fixed', optional: true, default_selected: false },
    { id: 'c', description: 'Core setup', qty: 1, unit_price: 250, type: 'fixed' },
    { id: 'd', description: 'Training (included)', qty: 1, unit_price: 0, type: 'fixed', optional: true },
  ],
  scope: [
    { phase: '2. Jobs', description: 'Schedule jobs.', deliverables: ['Calendar'], duration: 'TBC', estimated_hours: 40 },
    { phase: 'anything', description: 'Setup.', deliverables: [], duration: '1 week', line_item_id: 'c', estimated_hours: 12 },
  ],
  vat_rate: 0,
  payment_terms: '50% deposit',
  notes: 'Line one\nLine two',
  version: 2,
  updated_at: '2026-11-19T10:00:00Z',
  account_name: 'Bright Fire',
  contact_name: 'Sam Smith',
  contact_company: 'Other Co',
  acceptance: null,
  // Internal fields that must never surface:
  id: '11111111-1111-1111-1111-111111111111',
  internal_notes: CANARY,
  estimated_hours: 999,
  complexity_breakdown: { features_scored: [CANARY], buffer_applied: CANARY },
  draft_content: { overview: CANARY },
  final_content: { overview: CANARY },
  pricing_tier_id: '22222222-2222-2222-2222-222222222222',
  enquiry_id: '33333333-3333-3333-3333-333333333333',
  ai_generated: true,
  created_by_id: '44444444-4444-4444-4444-444444444444',
  public_token: 'x'.repeat(43),
  contact_email: 'sam@example.com',
} as unknown as ProposalRow

const company = { name: 'Trailhead Holdings Ltd', number: '16910286', email: 'rob@trailheadholdings.uk' }
const pq = buildPublicQuote(row, company, '2026-11-19')

describe('buildPublicQuote leak guard', () => {
  it('has exactly the allowlisted keys', () => {
    expect(Object.keys(pq).sort()).toEqual(QUOTE_KEYS)
    for (const item of pq.items) expect(Object.keys(item).sort()).toEqual(ITEM_KEYS)
    expect(Object.keys(pq.prepared_for).sort()).toEqual(['company', 'contact_first_name'])
    expect(Object.keys(pq.company).sort()).toEqual(['email', 'name', 'number'])
  })

  it('carries no internal value anywhere', () => {
    const json = JSON.stringify(pq)
    expect(json).not.toContain(CANARY)
    expect(json).not.toContain('999')
    expect(json).not.toContain('Smith')
    expect(json).not.toContain('sam@example.com')
    expect(json).not.toContain('x'.repeat(43))
    // The only ids are line item ids.
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/)
  })
})

describe('item join and display', () => {
  it('joins by line_item_id, then by exact phase name, and cleans titles', () => {
    const [a, b, c, d] = pq.items
    expect(a).toMatchObject({ title: 'Quotes', detail: 'Send quotes.', optional: true, default_selected: true, duration: null })
    expect(b).toMatchObject({ title: 'Jobs', detail: 'Schedule jobs.', deliverables: ['Calendar'], duration: null, default_selected: false })
    expect(c).toMatchObject({ title: 'Core setup', detail: 'Setup.', duration: '1 week', optional: false })
    expect(d).toMatchObject({ title: 'Training', included: true, optional: false, line_total: 0 })
    expect(pq.prepared_for).toEqual({ company: 'Bright Fire', contact_first_name: 'Sam' })
  })

  it('cleanItemTitle strips ordinals and the included suffix only', () => {
    expect(cleanItemTitle('10. Reporting')).toBe('Reporting')
    expect(cleanItemTitle('3) Forms (Included)')).toBe('Forms')
    expect(cleanItemTitle('2026 roadmap')).toBe('2026 roadmap')
  })
})

describe('state', () => {
  it('maps status and expiry in Europe/London', () => {
    expect(proposalState('sent', '2026-11-19', '2026-11-19')).toBe('open')
    expect(proposalState('sent', '2026-11-18', '2026-11-19')).toBe('expired')
    expect(proposalState('expired', null, '2026-11-19')).toBe('expired')
    expect(proposalState('accepted', null, '2026-11-19')).toBe('accepted')
    expect(proposalState('converted', null, '2026-11-19')).toBe('accepted')
    expect(proposalState('rejected', null, '2026-11-19')).toBe('declined')
    expect(proposalState('declined', null, '2026-11-19')).toBe('declined')
    expect(proposalState('draft', null, '2026-11-19')).toBe('unavailable')
  })

  it('londonToday uses the London calendar day', () => {
    // 23:30 UTC on 30 June is already 1 July in BST.
    expect(londonToday(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01')
  })
})

describe('selection', () => {
  it('always counts required and included items', () => {
    const t = selectionTotals(pq.items, [], 0)
    expect(t.total).toBe(250)
    expect(t.counted_ids.sort()).toEqual(['c', 'd'])
    expect(t.priced_count).toBe(1)
  })

  it('adds selected optional items and VAT', () => {
    expect(selectionTotals(pq.items, ['a', 'b'], 0).total).toBe(1250)
    expect(selectionTotals(pq.items, ['a'], 20)).toMatchObject({ subtotal: 750, vat_amount: 150, total: 900 })
  })

  it('parses ?sel= safely and falls back to defaults', () => {
    expect(initialSelection(null, pq.items)).toEqual(['a'])
    expect(initialSelection('b', pq.items)).toEqual(['b'])
    expect(initialSelection('', pq.items)).toEqual([])
    // Unknown and required ids are dropped; nothing valid → defaults.
    expect(parseSelection('zzz,c', pq.items)).toBeNull()
    expect(initialSelection('zzz,c', pq.items)).toEqual(['a'])
  })
})

describe('token format', () => {
  it('accepts only 43-char base64url', () => {
    expect(isProposalToken('A'.repeat(43))).toBe(true)
    expect(isProposalToken('A'.repeat(42))).toBe(false)
    expect(isProposalToken('A'.repeat(42) + '=')).toBe(false)
    expect(isProposalToken(undefined)).toBe(false)
  })
})
