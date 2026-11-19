import { calculateTotals, type InvoiceTotals, type PublicQuoteItem } from '@/lib/types'

/**
 * Selection maths for the proposal page, the accept API and the PDF. The one
 * place it lives. Pure, so the client page can import it too.
 *
 * Required items (not optional) are always counted, whatever selectedIds says.
 * Totals go through calculateTotals, so rounding happens in exactly the same
 * order as everywhere else in the OS (line roundMoney, subtotal, VAT, total).
 */

export interface SelectionTotals extends InvoiceTotals {
  /** Ids of every item counted: required + included + selected optional. */
  counted_ids: string[]
  /** Counted items with a price above zero. */
  priced_count: number
}

type SelectableItem = Pick<PublicQuoteItem, 'id' | 'qty' | 'unit_price' | 'optional' | 'title'>

export function isCounted(item: Pick<PublicQuoteItem, 'id' | 'optional'>, selected: ReadonlySet<string>): boolean {
  return !item.optional || selected.has(item.id)
}

export function selectionTotals(
  items: readonly SelectableItem[],
  selectedIds: readonly string[],
  vat_rate: number
): SelectionTotals {
  const selected = new Set(selectedIds)
  const counted = items.filter((item) => isCounted(item, selected))
  const totals = calculateTotals(
    counted.map((item) => ({ id: item.id, description: item.title, qty: item.qty, unit_price: item.unit_price })),
    vat_rate
  )
  return {
    ...totals,
    counted_ids: counted.map((item) => item.id),
    priced_count: counted.filter((item) => item.qty * item.unit_price > 0).length,
  }
}

/** The optional items each start switched on unless default_selected is false. */
export function defaultSelection(items: readonly Pick<PublicQuoteItem, 'id' | 'optional' | 'default_selected'>[]): string[] {
  return items.filter((item) => item.optional && item.default_selected).map((item) => item.id)
}

/**
 * Parse a `?sel=` value into optional item ids. Unknown ids and non-optional ids
 * are dropped. Returns null when the param is absent or yields nothing valid,
 * so the caller falls back to defaultSelection. An explicit empty `sel=` means
 * "nothing optional selected" and returns [].
 */
export function parseSelection(
  raw: string | null | undefined,
  items: readonly Pick<PublicQuoteItem, 'id' | 'optional'>[]
): string[] | null {
  if (raw === null || raw === undefined) return null
  const optionalIds = new Set(items.filter((item) => item.optional).map((item) => item.id))
  if (raw.trim() === '') return []
  const ids = [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => optionalIds.has(id)))]
  return ids.length > 0 ? ids : null
}

export function initialSelection(
  raw: string | null | undefined,
  items: readonly Pick<PublicQuoteItem, 'id' | 'optional' | 'default_selected'>[]
): string[] {
  return parseSelection(raw, items) ?? defaultSelection(items)
}
