'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import PricingTierSelector from './PricingTierSelector'
import RecordEmailDialog from './RecordEmailDialog'
import StatusBadge from './StatusBadge'
import type { Enquiry, PricingTier } from '@/lib/types'

function buildContactNotes(enquiry: Enquiry) {
  const sections = [
    `Converted from enquiry ${enquiry.id}`,
    enquiry.pain_points ? `Pain points: ${enquiry.pain_points}` : null,
    enquiry.timeline ? `Timeline: ${enquiry.timeline}` : null,
    enquiry.budget ? `Budget: ${enquiry.budget}` : null,
    enquiry.extra ? `Extra: ${enquiry.extra}` : null,
  ].filter(Boolean)

  return sections.join('\n')
}

export default function EnquiryDetailActions({
  enquiry,
  generatedQuoteId,
  generatedQuoteEmail,
}: {
  enquiry: Enquiry
  generatedQuoteId: string | null
  generatedQuoteEmail: string | null
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<'review' | 'convert' | 'generate' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function handleMarkReviewed() {
    setLoadingAction('review')
    setError(null)

    try {
      await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewed' }),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark enquiry as reviewed')
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleConvert() {
    setLoadingAction('convert')
    setError(null)

    try {
      const { contact } = await apiFetch<{ contact: { id: string } }>(
        '/api/contacts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: enquiry.contact_name,
            company: enquiry.biz_name,
            email: enquiry.contact_email,
            phone: enquiry.contact_phone,
            notes: buildContactNotes(enquiry),
            status: 'lead',
          }),
        }
      )

      await apiFetch<{ enquiry: Enquiry }>(`/api/enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'converted',
          converted_contact_id: contact.id,
        }),
      })

      router.push(`/crm/contacts/${contact.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert enquiry')
      setLoadingAction(null)
    }
  }

  async function handleGenerateQuote() {
    setLoadingAction('generate')
    setGenerateError(null)

    try {
      const response = await apiFetch<{ quote_id: string }>(
        '/api/quotes/ai-draft',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enquiry_id: enquiry.id,
            pricing_tier_id: selectedTier?.id,
          }),
        }
      )

      setShowGenerateModal(false)
      router.push(`/quotes/${response.quote_id}`)
      router.refresh()
    } catch (generateError) {
      setGenerateError(
        generateError instanceof Error ? generateError.message : 'Failed to generate quote'
      )
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Status</p>
        <StatusBadge
          status={enquiry.status}
          kind="enquiry"
          className="mt-4"
        />
        <div className="mt-6 space-y-3">
          {generatedQuoteId ? (
            <>
              <Link
                href={`/quotes/${generatedQuoteId}`}
                className="block rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-center text-sm font-semibold text-sky-100 transition hover:border-sky-400"
              >
                View generated quote →
              </Link>
              <RecordEmailDialog
                kind="quote"
                recordId={generatedQuoteId}
                buttonLabel="Email generated quote"
                dialogTitle="Email generated quote"
                defaultRecipient={generatedQuoteEmail}
                defaultSubject={`Quote for ${enquiry.biz_name}`}
                defaultMessage={`Hi,\n\nPlease find the attached quote for ${enquiry.biz_name}.\n\nBest,\nRob`}
                buttonClassName="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                fullWidth
              />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setGenerateError(null)
                  setShowGenerateModal(true)
                }}
                disabled={loadingAction !== null}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-400 disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
                </svg>
                Generate scope & quote with AI
              </button>
            </>
          )}

          {enquiry.status === 'new' ? (
            <button
              type="button"
              onClick={handleMarkReviewed}
              disabled={loadingAction !== null}
              className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 disabled:opacity-60"
            >
              {loadingAction === 'review' ? 'Marking...' : 'Mark as reviewed'}
            </button>
          ) : null}

          {enquiry.converted_contact_id ? (
            <Link
              href={`/crm/contacts/${enquiry.converted_contact_id}`}
              className="block rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              View converted contact
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={loadingAction !== null}
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {loadingAction === 'convert' ? 'Converting...' : 'Convert to contact'}
            </button>
          )}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Meta</p>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-slate-500">Enquiry ID</dt>
            <dd className="mt-1 text-slate-200">{enquiry.id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Submitted</dt>
            <dd className="mt-1 text-slate-200">
              {new Date(enquiry.created_at).toLocaleString('en-GB')}
            </dd>
          </div>
        </dl>
      </section>

      {showGenerateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-5xl rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-50">Select pricing tier</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Choose the rate structure for this quote.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (loadingAction === 'generate') {
                    return
                  }
                  setShowGenerateModal(false)
                }}
                className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                disabled={loadingAction === 'generate'}
              >
                Close
              </button>
            </div>

            <div className="mt-6">
              <PricingTierSelector
                value={selectedTier?.id ?? null}
                onChange={setSelectedTier}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="min-h-6">
                {loadingAction === 'generate' ? (
                  <div className="flex items-center gap-3 text-sm text-sky-100">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-100/30 border-t-sky-100" />
                    ChatGPT is analysing the enquiry and building your quote...
                  </div>
                ) : null}
                {generateError ? (
                  <p className="text-sm text-rose-300">{generateError}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleGenerateQuote}
                disabled={!selectedTier || loadingAction === 'generate'}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {loadingAction === 'generate' ? 'Generating quote...' : 'Generate quote'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
