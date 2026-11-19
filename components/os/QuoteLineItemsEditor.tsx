'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { gbp } from '@/lib/quotes/format'
import {
  QUOTE_LINE_ITEM_DETAIL_MAX,
  calculateTotals,
  type QuoteLineItem,
  type QuoteListItem,
  type QuoteScope,
} from '@/lib/types'

const EDITABLE_STATUSES = new Set(['draft', 'review', 'sent'])

interface DraftRow {
  id: string
  description: string
  detail: string
  type: QuoteLineItem['type']
  qty: string
  unit_price: string
  optional: boolean
  default_selected: boolean
}

function toDraft(item: QuoteLineItem): DraftRow {
  return {
    id: item.id,
    description: item.description,
    detail: item.detail ?? '',
    type: item.type ?? 'fixed',
    qty: String(item.qty),
    unit_price: String(item.unit_price),
    optional: item.optional === true,
    default_selected: item.default_selected !== false,
  }
}

function newRow(): DraftRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    detail: '',
    type: 'fixed',
    qty: '1',
    unit_price: '0',
    optional: false,
    default_selected: true,
  }
}

/** Draft rows → line items, or the first problem found. */
function toLineItems(rows: DraftRow[]): { items: QuoteLineItem[] } | { error: string } {
  const items: QuoteLineItem[] = []
  for (const [index, row] of rows.entries()) {
    const label = row.description.trim() || `Row ${index + 1}`
    const description = row.description.trim()
    if (!description) return { error: `${label}: add a title.` }
    const qty = Number(row.qty)
    const unitPrice = Number(row.unit_price)
    if (!Number.isFinite(qty) || qty <= 0) return { error: `${label}: quantity must be above zero.` }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: `${label}: price must be zero or more.` }
    const item: QuoteLineItem = { id: row.id, description, qty, unit_price: unitPrice, type: row.type }
    const detail = row.detail.trim()
    if (detail) item.detail = detail.slice(0, QUOTE_LINE_ITEM_DETAIL_MAX)
    // £0 rows always show as included on the proposal, so optional only matters when priced.
    if (row.optional && qty * unitPrice > 0) {
      item.optional = true
      if (!row.default_selected) item.default_selected = false
    }
    items.push(item)
  }
  return { items }
}

/**
 * Scope phases matched to a line item only by name lose their description on
 * the proposal when the item is renamed. Before saving, pin every name-matched
 * phase to its item's id (using the names as they were before editing).
 */
function linkScope(scope: QuoteScope[], before: QuoteLineItem[], after: QuoteLineItem[]): QuoteScope[] | null {
  const keptIds = new Set(after.map((item) => item.id))
  let changed = false
  const next = scope.map((phase) => {
    if (phase.line_item_id) return phase
    const match = before.find((item) => item.description === phase.phase && keptIds.has(item.id))
    if (!match) return phase
    changed = true
    return { ...phase, line_item_id: match.id }
  })
  return changed ? next : null
}

/**
 * Line items on the quote page. Read mode shows each item with its client
 * description and proposal badges. For draft, review and sent quotes "Edit"
 * turns the table into fields; Save replaces the line items in one PATCH, so a
 * half-edited price list is never stored. Accepted and converted quotes stay
 * read-only, as the edit page does.
 */
export default function QuoteLineItemsEditor({
  quote,
  onSaved,
}: {
  quote: QuoteListItem
  onSaved: (quote: QuoteListItem) => void
}) {
  const router = useRouter()
  const [rows, setRows] = useState<DraftRow[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable = EDITABLE_STATUSES.has(quote.status)
  const items = quote.line_items ?? []

  function startEditing() {
    setError(null)
    setRows(items.length > 0 ? items.map(toDraft) : [newRow()])
  }

  function update(id: string, patch: Partial<DraftRow>) {
    setRows((current) => current?.map((row) => (row.id === id ? { ...row, ...patch } : row)) ?? null)
  }

  function move(index: number, delta: number) {
    setRows((current) => {
      if (!current) return current
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    if (!rows) return
    const result = toLineItems(rows)
    if ('error' in result) {
      setError(result.error)
      return
    }
    if (result.items.length === 0) {
      setError('Keep at least one line item.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const patch: Record<string, unknown> = { line_items: result.items }
      const scope = linkScope(quote.scope ?? [], items, result.items)
      if (scope) patch.scope = scope
      const data = await apiFetch<{ quote: QuoteListItem }>(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onSaved(data.quote)
      setRows(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save line items')
    } finally {
      setSaving(false)
    }
  }

  const draftTotals = rows
    ? calculateTotals(
        rows.map((row) => ({ id: row.id, description: row.description, qty: Number(row.qty) || 0, unit_price: Number(row.unit_price) || 0 })),
        Number(quote.vat_rate) || 0
      )
    : null

  return (
    <div className="os-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="os-section-title">Line items</h2>
        {rows ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRows((current) =>
                  current?.map((row) => (Number(row.qty) * Number(row.unit_price) > 0 ? { ...row, optional: true } : row)) ?? null
                )
              }
              disabled={saving}
              className="btn btn-ghost btn-sm"
            >
              Make all optional
            </button>
            <button type="button" onClick={() => setRows(null)} disabled={saving} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Saving…' : 'Save line items'}
            </button>
          </div>
        ) : editable ? (
          <button type="button" onClick={startEditing} className="btn btn-ghost btn-sm">
            Edit line items
          </button>
        ) : null}
      </div>

      {rows ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[color:var(--text-2)]">
            Optional items can be switched off by the client on the proposal page. £0 items always show as included.
          </p>
          {rows.map((row, index) => {
            const lineTotal = (Number(row.qty) || 0) * (Number(row.unit_price) || 0)
            const priced = lineTotal > 0
            return (
              <div key={row.id} className="rounded-card border border-[color:var(--border)] p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_90px_120px_auto]">
                  <label className="space-y-1">
                    <span className="os-label">Title</span>
                    <input
                      value={row.description}
                      onChange={(e) => update(row.id, { description: e.target.value })}
                      disabled={saving}
                      className="os-input w-full px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="os-label">Type</span>
                    <select
                      value={row.type}
                      onChange={(e) => update(row.id, { type: e.target.value as QuoteLineItem['type'] })}
                      disabled={saving}
                      className="os-select w-full px-3 py-2 text-sm"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="hourly">Hourly</option>
                      <option value="milestone">Milestone</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="os-label">Qty</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.qty}
                      onChange={(e) => update(row.id, { qty: e.target.value })}
                      disabled={saving}
                      className="os-input w-full px-3 py-2 text-right text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="os-label">Unit £</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unit_price}
                      onChange={(e) => update(row.id, { unit_price: e.target.value })}
                      disabled={saving}
                      className="os-input w-full px-3 py-2 text-right text-sm"
                    />
                  </label>
                  <div className="flex items-end justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={saving || index === 0}
                      aria-label="Move up"
                      className="btn btn-ghost btn-sm"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={saving || index === rows.length - 1}
                      aria-label="Move down"
                      className="btn btn-ghost btn-sm"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setRows((current) => current?.filter((r) => r.id !== row.id) ?? null)}
                      disabled={saving}
                      className="btn btn-danger btn-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <textarea
                  value={row.detail}
                  onChange={(e) => update(row.id, { detail: e.target.value })}
                  maxLength={QUOTE_LINE_ITEM_DETAIL_MAX}
                  rows={2}
                  disabled={saving}
                  aria-label="Client description"
                  placeholder="Client description: what they get, in plain English. Shown on the proposal card."
                  className="os-textarea mt-3 w-full px-3 py-2 text-sm"
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--text-2)]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {priced ? (
                      <>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={row.optional}
                            onChange={(e) => update(row.id, { optional: e.target.checked })}
                            disabled={saving}
                            className="!m-0 !h-4 !w-4"
                          />
                          Optional
                        </label>
                        {row.optional ? (
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={row.default_selected}
                              onChange={(e) => update(row.id, { default_selected: e.target.checked })}
                              disabled={saving}
                              className="!m-0 !h-4 !w-4"
                            />
                            On by default
                          </label>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-[color:var(--text-3)]">Included at no charge</span>
                    )}
                  </div>
                  <span className="font-medium tabular-nums text-[color:var(--text)]">{gbp(lineTotal)}</span>
                </div>
              </div>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setRows((current) => [...(current ?? []), newRow()])}
              disabled={saving}
              className="btn btn-ghost btn-sm"
            >
              + Add line item
            </button>
            {draftTotals ? (
              <p className="text-sm text-[color:var(--text-2)]">
                Subtotal <span className="font-semibold tabular-nums text-[color:var(--text)]">{gbp(draftTotals.subtotal)}</span>
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[color:var(--red-strong)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="os-label text-left">
              <tr>
                <th className="pb-3">Description</th>
                <th className="pb-3">Type</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit price</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const lineTotal = item.qty * item.unit_price
                return (
                  <tr key={item.id} className="border-t border-[color:var(--border)] align-top">
                    <td className="py-3 pr-4">
                      <span className="text-[color:var(--text)]">{item.description}</span>
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {lineTotal === 0 ? (
                          <span className="rounded-pill bg-[var(--emerald-dim)] px-2 py-0.5 text-xs font-semibold text-[color:var(--emerald-strong)]">Included</span>
                        ) : item.optional ? (
                          <span className="rounded-pill bg-[var(--accent-dim)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent-strong)]">
                            Optional{item.default_selected === false ? ', off by default' : ''}
                          </span>
                        ) : null}
                      </span>
                      {item.detail ? <p className="mt-1 max-w-prose text-xs text-[color:var(--text-2)]">{item.detail}</p> : null}
                    </td>
                    <td className="py-3 text-[color:var(--text-2)]">{item.type}</td>
                    <td className="py-3 text-right text-[color:var(--text-2)]">{item.qty}</td>
                    <td className="py-3 text-right text-[color:var(--text-2)]">{gbp(item.unit_price)}</td>
                    <td className="py-3 text-right text-[color:var(--text)]">{gbp(lineTotal)}</td>
                  </tr>
                )
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[color:var(--text-3)]">
                    No line items yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
