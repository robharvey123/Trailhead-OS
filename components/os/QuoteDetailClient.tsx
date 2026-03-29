'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import StatusBadge from './StatusBadge'
import WorkstreamBadge from './WorkstreamBadge'
import { calculateTotals, type QuoteListItem } from '@/lib/types'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function QuoteDetailClient({
  quote,
  warning,
}: {
  quote: QuoteListItem
  warning?: string | null
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const totals = calculateTotals(quote.line_items, quote.vat_rate)

  async function patchQuote(patch: Record<string, unknown>) {
    setLoadingAction(JSON.stringify(patch))
    setError(null)

    try {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update quote')
      }

      router.refresh()
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Failed to update quote')
    } finally {
      setLoadingAction(null)
    }
  }

  async function duplicateQuote() {
    setLoadingAction('duplicate')
    setError(null)

    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quote,
          title: `Copy of ${quote.title}`,
          status: 'draft',
          converted_invoice_id: null,
          issue_date: new Date().toISOString().slice(0, 10),
          ai_generated: false,
          ai_generated_at: null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate quote')
      }

      router.push(`/quotes/${data.quote.id}`)
      router.refresh()
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : 'Failed to duplicate quote')
      setLoadingAction(null)
    }
  }

  async function convertToInvoice() {
    setLoadingAction('convert')
    setError(null)

    try {
      const response = await fetch(`/api/quotes/${quote.id}/convert`, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert quote')
      }

      router.push(`/invoicing/${data.invoice_id}`)
      router.refresh()
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : 'Failed to convert quote')
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {warning === 'edit-blocked' ? (
        <div className="rounded-[1.75rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Accepted and converted quotes are locked. You were redirected back to the detail view.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Quote</p>
                  <StatusBadge status={quote.status} kind="quote" />
                  {quote.ai_generated ? (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                      AI draft
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-slate-50">{quote.quote_number}</h1>
                  {quote.pricing_tier ? (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                      {quote.pricing_tier.name} tier
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-lg text-slate-200">{quote.title}</p>
              </div>
              {quote.workstream ? (
                <WorkstreamBadge
                  label={quote.workstream.label}
                  slug={quote.workstream.label}
                  colour={quote.workstream.colour}
                />
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
                <p className="mt-2 text-sm text-slate-200">{quote.account?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contact</p>
                <p className="mt-2 text-sm text-slate-200">{quote.contact?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Issue date</p>
                <p className="mt-2 text-sm text-slate-200">{quote.issue_date}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Valid until</p>
                <p className="mt-2 text-sm text-slate-200">{quote.valid_until ?? '—'}</p>
              </div>
            </div>
          </div>

          {quote.summary ? (
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{quote.summary}</p>
            </div>
          ) : null}

          {quote.ai_generated && (quote.estimated_hours || quote.estimated_timeline) ? (
            <div className="rounded-[2rem] border border-sky-500/20 bg-sky-500/5 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Estimated hours & timeline</h2>
              <p className="mt-4 text-sm text-sky-100">
                Estimated: {quote.estimated_hours ?? '—'} hours
                {quote.estimated_timeline ? ` · ${quote.estimated_timeline}` : ''}
              </p>
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Scope of work</h2>
            {quote.scope.length ? (
              <div className="mt-4 space-y-4">
                {quote.scope.map((phase, index) => (
                  <div key={`${phase.phase}-${index}`} className="rounded-[1.5rem] border border-slate-800 bg-slate-950/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-100">
                        {index + 1}. {phase.phase}
                      </p>
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                        {phase.duration}
                        {phase.estimated_hours ? ` · ${phase.estimated_hours} hrs` : ''}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{phase.description}</p>
                    {phase.deliverables.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
                        {phase.deliverables.map((deliverable, deliverableIndex) => (
                          <li key={`${deliverable}-${deliverableIndex}`}>{deliverable}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No scope phases added.</p>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Line items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="pb-3">Description</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3 text-right">Qty</th>
                    <th className="pb-3 text-right">Unit price</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="py-3 text-slate-100">{item.description}</td>
                      <td className="py-3 text-slate-300">{item.type}</td>
                      <td className="py-3 text-right text-slate-300">{item.qty}</td>
                      <td className="py-3 text-right text-slate-300">{formatMoney(item.unit_price)}</td>
                      <td className="py-3 text-right text-slate-100">{formatMoney(item.qty * item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {quote.ai_generated && quote.complexity_breakdown ? (
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Complexity breakdown</h2>
              <p className="mt-2 text-sm text-slate-400">How this estimate was calculated.</p>
              <div className="mt-4 space-y-4">
                {quote.complexity_breakdown.features_scored.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                    {quote.complexity_breakdown.features_scored.map((feature, index) => (
                      <li key={`${feature}-${index}`}>{feature}</li>
                    ))}
                  </ul>
                ) : null}

                <dl className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Before buffer
                    </dt>
                    <dd className="mt-2 text-base font-medium text-slate-100">
                      {quote.complexity_breakdown.total_hours_before_buffer} hrs
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Overhead</dt>
                    <dd className="mt-2 text-base font-medium text-slate-100">
                      {quote.complexity_breakdown.overhead_hours} hrs
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Final with {quote.complexity_breakdown.buffer_applied}
                    </dt>
                    <dd className="mt-2 text-base font-medium text-slate-100">
                      {quote.complexity_breakdown.total_hours_final} hrs
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
                <h2 className="text-lg font-semibold text-slate-100">Payment terms</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{quote.payment_terms ?? '—'}</p>
              </div>

              {quote.notes ? (
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{quote.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Invoice summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">Subtotal</dt>
                  <dd className="font-medium text-slate-100">{formatMoney(totals.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">VAT ({quote.vat_rate}%)</dt>
                  <dd className="font-medium text-slate-100">{formatMoney(totals.vat_amount)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
                  <dt className="text-base font-semibold text-slate-100">Total</dt>
                  <dd className="text-lg font-semibold text-white">{formatMoney(totals.total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
            <StatusBadge status={quote.status} kind="quote" className="mt-4" />

            <div className="mt-6 space-y-3">
              {quote.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => patchQuote({ status: 'sent' })}
                  disabled={loadingAction !== null}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Mark as sent
                </button>
              ) : null}

              {quote.status === 'sent' ? (
                <>
                  <button
                    type="button"
                    onClick={() => patchQuote({ status: 'accepted' })}
                    disabled={loadingAction !== null}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    Mark as accepted
                  </button>
                  <button
                    type="button"
                    onClick={() => patchQuote({ status: 'declined' })}
                    disabled={loadingAction !== null}
                    className="w-full rounded-2xl border border-rose-500/30 px-4 py-3 text-sm text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
                  >
                    Mark as declined
                  </button>
                </>
              ) : null}

              {quote.status === 'accepted' ? (
                <button
                  type="button"
                  onClick={convertToInvoice}
                  disabled={loadingAction !== null}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Convert to invoice
                </button>
              ) : null}

              {quote.status === 'converted' && quote.invoice ? (
                <Link
                  href={`/invoicing/${quote.invoice.id}`}
                  className="block rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                >
                  View invoice →
                </Link>
              ) : null}
            </div>

            <div className="mt-6 space-y-3 border-t border-slate-800 pt-6">
              {(quote.status === 'draft' || quote.status === 'sent') ? (
                <Link
                  href={`/quotes/${quote.id}/edit`}
                  className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                  Edit quote
                </Link>
              ) : null}

              <a
                href={`/api/quotes/${quote.id}/pdf`}
                className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Download PDF
              </a>

              <button
                type="button"
                onClick={duplicateQuote}
                disabled={loadingAction !== null}
                className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
              >
                Duplicate quote
              </button>
            </div>

            {quote.status === 'converted' && quote.invoice ? (
              <div className="mt-6 rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Converted invoice</p>
                <p className="mt-2 text-sm text-slate-100">{quote.invoice.invoice_number}</p>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
