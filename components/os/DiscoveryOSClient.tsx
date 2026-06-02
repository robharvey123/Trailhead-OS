'use client'

import Link from 'next/link'
import { useState } from 'react'

export type DiscoveryEnquiryRow = {
  id: string
  biz_name: string
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  created_at: string
  status: 'new' | 'reviewed' | 'converted'
}

function formatSubmittedDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusClasses(status: DiscoveryEnquiryRow['status']) {
  if (status === 'reviewed') {
    return 'bg-[var(--accent-dim)] text-[color:var(--accent-strong)] ring-1 ring-[color:var(--border-light)]'
  }

  if (status === 'converted') {
    return 'bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)] ring-1 ring-[color:var(--border-light)]'
  }

  return 'bg-[var(--amber-dim)] text-[color:var(--amber-strong)] ring-1 ring-[color:var(--border-light)]'
}

export default function DiscoveryOSClient({
  enquiries,
}: {
  enquiries: DiscoveryEnquiryRow[]
}) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [publicUrl] = useState(() =>
    typeof window === 'undefined'
      ? '/discovery'
      : new URL('/discovery', window.location.origin).toString()
  )

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function handleOpenForm() {
    window.open('/discovery?view=form', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="os-eyebrow">Clients</p>
        <h1 className="os-page-title mt-2">Discovery form</h1>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Send this link to clients to capture their app requirements.
        </p>
      </div>

      <section className="os-card p-6">
        <div className="space-y-4">
          <div>
            <p className="os-eyebrow">Public form URL</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="os-input w-full px-4 py-3 text-sm"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenForm}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-light)] hover:bg-[var(--surface-2)]"
                >
                  Open form
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((current) => !current)}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--border-light)] hover:bg-[var(--surface-2)]"
                >
                  {showPreview ? 'Hide preview' : 'Preview'}
                </button>
              </div>
            </div>
          </div>

          {showPreview ? (
            <iframe
              src="/discovery?view=form"
              title="Discovery form preview"
              className="mt-4 w-full rounded-lg border border-[color:var(--border)]"
              style={{ height: '600px' }}
            />
          ) : null}
        </div>
      </section>

      <section className="os-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="os-section-title">Recent submissions</h2>
        </div>

        {enquiries.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No enquiries yet. Share the form link above to get started.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-[color:var(--border)]">
            <table className="min-w-full divide-y divide-[color:var(--border)] text-left">
              <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)] bg-white text-sm text-[color:var(--text-2)]">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td className="px-4 py-4 font-medium text-[color:var(--text)]">{enquiry.biz_name}</td>
                    <td className="px-4 py-4">{enquiry.contact_name}</td>
                    <td className="px-4 py-4 text-[color:var(--text-2)]">
                      {enquiry.contact_email ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-[color:var(--text-2)]">
                      {enquiry.contact_phone ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-[color:var(--text-2)]">
                      {formatSubmittedDate(enquiry.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusClasses(enquiry.status)}`}
                      >
                        {enquiry.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/enquiries/${enquiry.id}`}
                        className="inline-flex rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5">
          <Link
            href="/enquiries"
            className="text-sm font-medium text-[color:var(--text-2)] transition hover:text-[color:var(--accent-strong)]"
          >
            View all enquiries →
          </Link>
        </div>
      </section>
    </div>
  )
}
