import { describe, expect, it, vi } from 'vitest'

// cowork-quotes imports the service-role client at module load; these are pure parser tests.
vi.mock('@/lib/supabase/service', () => ({ supabaseService: {} }))
import { parseQuoteItems, parseQuoteLineItems, parseQuoteScope } from '@/lib/cowork-quotes'
import { pickLineItemExtras, pickScopeLink } from '@/lib/quotes/line-item-fields'

describe('pickLineItemExtras', () => {
  it('keeps valid proposal fields', () => {
    expect(pickLineItemExtras({ optional: true, default_selected: false, detail: '  Card text  ' })).toEqual({
      optional: true,
      default_selected: false,
      detail: 'Card text',
    })
  })

  it('coerces booleans strictly and omits absent or invalid values', () => {
    expect(pickLineItemExtras({ optional: 'true', default_selected: 'false', detail: '   ' })).toEqual({})
    expect(pickLineItemExtras({ optional: 1 })).toEqual({})
    expect(pickLineItemExtras({ optional: false })).toEqual({})
    expect(pickLineItemExtras({})).toEqual({})
  })

  it('caps detail at 1,000 characters', () => {
    expect(pickLineItemExtras({ detail: 'x'.repeat(1500) }).detail).toHaveLength(1000)
  })
})

describe('pickScopeLink', () => {
  it('keeps a trimmed id and drops anything else', () => {
    expect(pickScopeLink({ line_item_id: ' abc ' })).toEqual({ line_item_id: 'abc' })
    expect(pickScopeLink({ line_item_id: '' })).toEqual({})
    expect(pickScopeLink({ line_item_id: 42 })).toEqual({})
    expect(pickScopeLink({ line_item_id: 'x'.repeat(101) })).toEqual({})
  })
})

describe('Cowork / MCP parsers round-trip the proposal fields', () => {
  it('parseQuoteLineItems keeps id, optional, default_selected and detail', () => {
    const [item] = parseQuoteLineItems([
      { id: 'li-1', description: 'Quotes', qty: 1, unit_price: 500, optional: true, default_selected: false, detail: 'Send quotes from site.' },
    ])
    expect(item).toEqual({
      id: 'li-1',
      description: 'Quotes',
      qty: 1,
      unit_price: 500,
      type: 'fixed',
      optional: true,
      default_selected: false,
      detail: 'Send quotes from site.',
    })
  })

  it('parseQuoteScope keeps line_item_id', () => {
    const [phase] = parseQuoteScope([{ phase: 'Quotes', description: 'Send quotes.', line_item_id: 'li-1' }])
    expect(phase.line_item_id).toBe('li-1')
  })

  it('parseQuoteItems links each scope phase to its line item', () => {
    const { line_items, scope } = parseQuoteItems([
      { title: 'Quotes', description: 'Send quotes.', price: 500, optional: true },
      { title: 'Training', description: 'Included.', price: 0 },
    ])
    expect(scope.map((s) => s.line_item_id)).toEqual(line_items.map((li) => li.id))
    expect(line_items[0].optional).toBe(true)
    expect(line_items[1].optional).toBeUndefined()
  })
})
