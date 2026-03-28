'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import StatusBadge from './StatusBadge'
import type { Enquiry } from '@/lib/types'

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
}: {
  enquiry: Enquiry
}) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<'review' | 'convert' | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    </div>
  )
}
