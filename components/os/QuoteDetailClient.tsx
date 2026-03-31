'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import EmailThread from './EmailThread'
import RecordEmailDialog from './RecordEmailDialog'
import StatusBadge from './StatusBadge'
import WorkstreamBadge from './WorkstreamBadge'
import {
  calculateTotals,
  type QuoteDraftContent,
  type QuoteListItem,
  type QuoteVersion,
} from '@/lib/types'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

function buildDraftContent(quote: QuoteListItem): QuoteDraftContent {
  if (quote.final_content) {
    return quote.final_content
  }

  if (quote.draft_content) {
    return quote.draft_content
  }

  return {
    overview: quote.summary ?? '',
    approach: quote.scope[0]?.description ?? '',
    scope: quote.scope.map((phase) => `${phase.phase}: ${phase.description}`),
    assumptions: quote.notes
      ? quote.notes
          .split(/\n|\.|;/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
    pricing: quote.line_items.map((item) => ({
      item: item.description,
      description: `${item.qty} x ${item.type}`,
      amount: `GBP ${(item.qty * item.unit_price).toFixed(2)}`,
    })),
    next_steps: 'Confirm the scope and approve the quote to move into delivery planning.',
  }
}

function listToText(items: string[]) {
  return items.join('\n')
}

function parseList(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function formatVersionTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value))
}

export default function QuoteDetailClient({
  quote,
  versions,
  warning,
}: {
  quote: QuoteListItem
  versions: QuoteVersion[]
  warning?: string | null
}) {
  const router = useRouter()
  const [quoteState, setQuoteState] = useState(quote)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState<QuoteDraftContent>(() => buildDraftContent(quote))
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null)
  const draftTimeoutRef = useRef<number | null>(null)
  const lastSavedDraftRef = useRef(JSON.stringify(buildDraftContent(quote)))
  const isLocked =
    quoteState.status === 'sent' || quoteState.status === 'accepted' || quoteState.status === 'converted'
  const totals = calculateTotals(quoteState.line_items, quoteState.vat_rate)

  useEffect(() => {
    setQuoteState(quote)
    const nextDraftContent = buildDraftContent(quote)
    setDraftContent(nextDraftContent)
    lastSavedDraftRef.current = JSON.stringify(nextDraftContent)
    setDraftSaveState('idle')
    setDraftSaveMessage(null)
  }, [quote])

  async function patchQuote(patch: Record<string, unknown>) {
    setLoadingAction(JSON.stringify(patch))
    setError(null)

    try {
      const data = await apiFetch<{ quote: QuoteListItem }>(`/api/quotes/${quoteState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      setQuoteState(data.quote)
      router.refresh()
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Failed to update quote')
    } finally {
      setLoadingAction(null)
    }
  }

  useEffect(() => {
    if (isLocked) {
      return
    }

    const serializedDraft = JSON.stringify(draftContent)
    if (serializedDraft === lastSavedDraftRef.current) {
      return
    }

    setDraftSaveState('saving')
    setDraftSaveMessage('Saving draft...')

    if (draftTimeoutRef.current) {
      window.clearTimeout(draftTimeoutRef.current)
    }

    draftTimeoutRef.current = window.setTimeout(async () => {
      try {
        const { quote: updatedQuote } = await apiFetch<{ quote: QuoteListItem }>(
          `/api/quotes/${quoteState.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draft_content: draftContent,
              summary: draftContent.overview,
              notes: draftContent.assumptions.join('\n'),
            }),
          }
        )

        const normalizedDraft = buildDraftContent(updatedQuote)
        const normalizedDraftJson = JSON.stringify(normalizedDraft)
        lastSavedDraftRef.current = normalizedDraftJson
        setQuoteState(updatedQuote)
        setDraftContent(normalizedDraft)
        setDraftSaveState('saved')
        setDraftSaveMessage(
          `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        )
        router.refresh()
      } catch (saveError) {
        setDraftSaveState('error')
        setDraftSaveMessage(
          saveError instanceof Error ? saveError.message : 'Failed to save draft content'
        )
      }
    }, 1000)

    return () => {
      if (draftTimeoutRef.current) {
        window.clearTimeout(draftTimeoutRef.current)
      }
    }
  }, [draftContent, isLocked, quoteState.id, router])

  async function duplicateQuote() {
    setLoadingAction('duplicate')
    setError(null)

    try {
      const data = await apiFetch<{ quote: QuoteListItem }>('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quoteState,
          title: `Copy of ${quoteState.title}`,
          status: 'draft',
          converted_invoice_id: null,
          issue_date: new Date().toISOString().slice(0, 10),
          ai_generated: false,
          ai_generated_at: null,
          sent_at: null,
        }),
      })

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
      const response = await fetch(`/api/quotes/${quoteState.id}/convert`, { method: 'POST' })
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

  async function createProjectFromQuote(aiPlan: boolean) {
    setLoadingAction(aiPlan ? 'create-project-ai' : 'create-project')
    setError(null)

    try {
      const data = await apiFetch<{ project_id: string }>(`/api/quotes/${quoteState.id}/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_plan: aiPlan }),
      })

      router.push(`/projects/records/${data.project_id}`)
      router.refresh()
    } catch (projectError) {
      setError(projectError instanceof Error ? projectError.message : 'Failed to create project from quote')
      setLoadingAction(null)
    }
  }

  async function markReadyToSend() {
    await patchQuote({
      status: 'review',
      final_content: draftContent,
      summary: draftContent.overview,
      notes: draftContent.assumptions.join('\n'),
    })
  }

  async function handleQuoteSent() {
    const now = new Date().toISOString()
    await patchQuote({
      status: 'sent',
      sent_at: now,
      final_content: draftContent,
      summary: draftContent.overview,
      notes: draftContent.assumptions.join('\n'),
    })
  }

  const pricingPreview = useMemo(
    () => draftContent.pricing.map((item) => `${item.item}: ${item.amount}`).join(' · '),
    [draftContent.pricing]
  )

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
                  <StatusBadge status={quoteState.status} kind="quote" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-slate-50">{quoteState.quote_number}</h1>
                  {quoteState.pricing_tier ? (
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                      {quoteState.pricing_tier.name} tier
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                    v{quoteState.version}
                  </span>
                </div>
                <p className="mt-2 text-lg text-slate-200">{quoteState.title}</p>
              </div>
              {quoteState.workstream ? (
                <WorkstreamBadge
                  label={quoteState.workstream.label}
                  slug={quoteState.workstream.label}
                  colour={quoteState.workstream.colour}
                />
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account</p>
                <p className="mt-2 text-sm text-slate-200">{quoteState.account?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contact</p>
                <p className="mt-2 text-sm text-slate-200">{quoteState.contact?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Project</p>
                <p className="mt-2 text-sm text-slate-200">
                  {quoteState.project ? (
                    <Link href={`/projects/records/${quoteState.project.id}`} className="text-sky-300 transition hover:text-sky-200">
                      {quoteState.project.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Enquiry</p>
                <p className="mt-2 text-sm text-slate-200">
                  {quoteState.enquiry ? (
                    <Link href={`/enquiries/${quoteState.enquiry.id}`} className="text-sky-300 transition hover:text-sky-200">
                      {quoteState.enquiry.biz_name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Issue date</p>
                <p className="mt-2 text-sm text-slate-200">{quoteState.issue_date}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Valid until</p>
                <p className="mt-2 text-sm text-slate-200">{quoteState.valid_until ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Draft quote</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Edit the client-facing draft inline. Autosaves after 1 second.
                </p>
              </div>
              <p
                className={`text-xs ${
                  draftSaveState === 'error'
                    ? 'text-rose-300'
                    : draftSaveState === 'saved'
                      ? 'text-emerald-300'
                      : 'text-slate-500'
                }`}
              >
                {draftSaveMessage ?? (isLocked ? 'Locked after sending' : 'Editable draft')}
              </p>
            </div>

            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Overview</span>
                <textarea
                  rows={4}
                  value={draftContent.overview}
                  disabled={isLocked}
                  onChange={(event) => setDraftContent((current) => ({ ...current, overview: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Approach</span>
                <textarea
                  rows={5}
                  value={draftContent.approach}
                  disabled={isLocked}
                  onChange={(event) => setDraftContent((current) => ({ ...current, approach: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">Scope bullets</span>
                  <textarea
                    rows={7}
                    value={listToText(draftContent.scope)}
                    disabled={isLocked}
                    onChange={(event) =>
                      setDraftContent((current) => ({ ...current, scope: parseList(event.target.value) }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-300">Assumptions</span>
                  <textarea
                    rows={7}
                    value={listToText(draftContent.assumptions)}
                    disabled={isLocked}
                    onChange={(event) =>
                      setDraftContent((current) => ({ ...current, assumptions: parseList(event.target.value) }))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Pricing summary</span>
                <textarea
                  rows={6}
                  value={draftContent.pricing.map((item) => `${item.item} | ${item.description} | ${item.amount}`).join('\n')}
                  disabled={isLocked}
                  onChange={(event) =>
                    setDraftContent((current) => ({
                      ...current,
                      pricing: event.target.value
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean)
                        .map((line) => {
                          const [item = '', description = '', amount = ''] = line.split('|').map((part) => part.trim())
                          return { item, description, amount }
                        })
                        .filter((item) => item.item && item.description && item.amount),
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                />
                <p className="mt-2 text-xs text-slate-500">One item per line in the format: item | description | amount</p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Next steps</span>
                <textarea
                  rows={3}
                  value={draftContent.next_steps}
                  disabled={isLocked}
                  onChange={(event) => setDraftContent((current) => ({ ...current, next_steps: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 disabled:opacity-60"
                />
              </label>
            </div>
          </div>

          {quoteState.ai_generated && (quoteState.estimated_hours || quoteState.estimated_timeline) ? (
            <div className="rounded-[2rem] border border-sky-500/20 bg-sky-500/5 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Estimated hours & timeline</h2>
              <p className="mt-4 text-sm text-sky-100">
                Estimated: {quoteState.estimated_hours ?? '—'} hours
                {quoteState.estimated_timeline ? ` · ${quoteState.estimated_timeline}` : ''}
              </p>
              {pricingPreview ? <p className="mt-2 text-sm text-slate-300">{pricingPreview}</p> : null}
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Scope of work</h2>
            {quoteState.scope.length ? (
              <div className="mt-4 space-y-4">
                {quoteState.scope.map((phase, index) => (
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
                  {quoteState.line_items.map((item) => (
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

          {quoteState.ai_generated && quoteState.complexity_breakdown ? (
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Complexity breakdown</h2>
              <p className="mt-2 text-sm text-slate-400">How this estimate was calculated.</p>
              <div className="mt-4 space-y-4">
                {quoteState.complexity_breakdown.features_scored.length ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                    {quoteState.complexity_breakdown.features_scored.map((feature, index) => (
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
                      {quoteState.complexity_breakdown.total_hours_before_buffer} hrs
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Overhead</dt>
                    <dd className="mt-2 text-base font-medium text-slate-100">
                      {quoteState.complexity_breakdown.overhead_hours} hrs
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Final with {quoteState.complexity_breakdown.buffer_applied}
                    </dt>
                    <dd className="mt-2 text-base font-medium text-slate-100">
                      {quoteState.complexity_breakdown.total_hours_final} hrs
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
                <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{quoteState.payment_terms ?? '—'}</p>
              </div>

              {quoteState.notes ? (
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{quoteState.notes}</p>
                </div>
              ) : null}

              {versions.length ? (
                <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
                  <h2 className="text-lg font-semibold text-slate-100">Version history</h2>
                  <div className="mt-4 space-y-3">
                    {versions.map((version) => (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-100">Version {version.version}</p>
                          <p className="text-xs text-slate-500">{formatVersionTimestamp(version.generated_at)}</p>
                        </div>
                        {!isLocked ? (
                          <button
                            type="button"
                            onClick={() => setDraftContent(version.content)}
                            className="rounded-2xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500"
                          >
                            Restore into draft
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <details className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
                <summary className="cursor-pointer list-none text-lg font-semibold text-slate-100">
                  Email thread
                </summary>
                <div className="mt-4">
                  <EmailThread
                    contact_id={quoteState.contact_id}
                    contact_email={quoteState.contact?.email}
                    account_id={quoteState.account_id}
                    enquiry_id={quoteState.enquiry_id}
                    quote_id={quoteState.id}
                    embedded
                  />
                </div>
              </details>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-lg font-semibold text-slate-100">Invoice summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">Subtotal</dt>
                  <dd className="font-medium text-slate-100">{formatMoney(totals.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-400">VAT ({quoteState.vat_rate}%)</dt>
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
            <StatusBadge status={quoteState.status} kind="quote" className="mt-4" />

            <div className="mt-6 space-y-3">
              {quoteState.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => void markReadyToSend()}
                  disabled={loadingAction !== null}
                  className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  Mark ready to send
                </button>
              ) : null}

              {(quoteState.status === 'review' || quoteState.status === 'draft') && quoteState.contact?.email ? (
                <RecordEmailDialog
                  kind="quote"
                  recordId={quoteState.id}
                  buttonLabel="Send to client"
                  dialogTitle="Send quote to client"
                  defaultRecipient={quoteState.contact?.email ?? quoteState.enquiry?.contact_email ?? null}
                  defaultSubject={`Quote for ${quoteState.account?.name ?? quoteState.enquiry?.biz_name ?? quoteState.title}`}
                  defaultMessage={`Hi,\n\nPlease find the attached quote for ${quoteState.title}. Let me know if you would like to review any part of the scope.\n\nBest,\nRob`}
                  buttonClassName="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                  fullWidth
                  onSent={handleQuoteSent}
                />
              ) : null}

              {quoteState.status === 'sent' ? (
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

              {quoteState.status === 'accepted' ? (
                <>
                  {!quoteState.project ? (
                    <button
                      type="button"
                      onClick={() => void createProjectFromQuote(true)}
                      disabled={loadingAction !== null}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                    >
                      {loadingAction === 'create-project-ai' ? 'Creating AI project...' : 'Create project with AI plan'}
                    </button>
                  ) : null}

                  {!quoteState.project ? (
                    <button
                      type="button"
                      onClick={() => void createProjectFromQuote(false)}
                      disabled={loadingAction !== null}
                      className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                    >
                      {loadingAction === 'create-project' ? 'Creating project...' : 'Create project only'}
                    </button>
                  ) : (
                    <Link
                      href={`/projects/records/${quoteState.project.id}`}
                      className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
                    >
                      View linked project
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={convertToInvoice}
                    disabled={loadingAction !== null}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    Convert to invoice
                  </button>
                </>
              ) : null}

              {quoteState.status === 'converted' && quoteState.invoice ? (
                <Link
                  href={`/invoicing/${quoteState.invoice.id}`}
                  className="block rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                >
                  View invoice →
                </Link>
              ) : null}
            </div>

            <div className="mt-6 space-y-3 border-t border-slate-800 pt-6">
              {(quoteState.status === 'draft' || quoteState.status === 'review' || quoteState.status === 'sent') ? (
                <Link
                  href={`/quotes/${quoteState.id}/edit`}
                  className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                  Edit quote
                </Link>
              ) : null}

              <a
                href={`/api/quotes/${quoteState.id}/pdf`}
                className="block rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Download PDF
              </a>

              <RecordEmailDialog
                kind="quote"
                recordId={quoteState.id}
                buttonLabel="Email quote"
                dialogTitle="Email quote"
                defaultRecipient={quoteState.contact?.email ?? quoteState.enquiry?.contact_email ?? null}
                defaultSubject={`Quote ${quoteState.quote_number} - ${quoteState.title}`}
                defaultMessage={`Hi,\n\nPlease find the attached quote for ${quoteState.title}.\n\nLet me know if you have any questions.`}
                buttonClassName="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                fullWidth
              />

              <button
                type="button"
                onClick={duplicateQuote}
                disabled={loadingAction !== null}
                className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
              >
                Duplicate quote
              </button>
            </div>

            {quoteState.status === 'converted' && quoteState.invoice ? (
              <div className="mt-6 rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Converted invoice</p>
                <p className="mt-2 text-sm text-slate-100">{quoteState.invoice.invoice_number}</p>
              </div>
            ) : null}

            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
