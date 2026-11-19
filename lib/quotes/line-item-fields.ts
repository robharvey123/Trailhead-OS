import { QUOTE_LINE_ITEM_DETAIL_MAX, type QuoteLineItem, type QuoteScope } from '@/lib/types'

/**
 * The proposal-page fields on quote line items and scope phases, read the same
 * way by every sanitiser (create/PATCH routes, AI draft, Cowork/MCP parsers,
 * the quote form). Each site builds its own core fields and spreads these in,
 * so a new field cannot be dropped by one path and kept by another.
 *
 * Absent or invalid values are omitted rather than written as defaults, so
 * existing JSONB rows keep their shape.
 */
export type QuoteLineItemExtras = Pick<QuoteLineItem, 'optional' | 'default_selected' | 'detail'>

export function pickLineItemExtras(record: Record<string, unknown>): QuoteLineItemExtras {
  const extras: QuoteLineItemExtras = {}

  // Strict: only a real boolean true makes an item optional. "true", 1 etc. do not.
  if (record.optional === true) extras.optional = true

  // Default is true, so only an explicit boolean is stored. Strings are ignored.
  if (typeof record.default_selected === 'boolean') extras.default_selected = record.default_selected

  if (typeof record.detail === 'string') {
    const detail = record.detail.trim().slice(0, QUOTE_LINE_ITEM_DETAIL_MAX).trim()
    if (detail) extras.detail = detail
  }

  return extras
}

const LINE_ITEM_ID_MAX = 100

export function pickScopeLink(record: Record<string, unknown>): Pick<QuoteScope, 'line_item_id'> {
  if (typeof record.line_item_id !== 'string') return {}
  const id = record.line_item_id.trim()
  return id && id.length <= LINE_ITEM_ID_MAX ? { line_item_id: id } : {}
}
