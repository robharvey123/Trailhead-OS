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
    return 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/20'
  }

  if (status === 'converted') {
    return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20'
  }

  return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20'
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
        <p className="text-xs uppercase tracking-[0.32em] text-white0">Clients</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Discovery form</h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">
          Send this link to clients to capture their app requirements.
        </p>
      </div>

      <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-white0">Public form URL</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenForm}
                  className="rounded-2xl border border-[#2A2A3A] px-4 py-3 text-sm font-medium text-white transition hover:border-[#B8FF00]/40 hover:bg-[#2A2A3A]"
                >
                  Open form
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((current) => !current)}
                  className="rounded-2xl border border-[#2A2A3A] px-4 py-3 text-sm font-medium text-white transition hover:border-[#B8FF00]/40 hover:bg-[#2A2A3A]"
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
              className="mt-4 w-full rounded-lg border border-gray-200"
              style={{ height: '600px' }}
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Recent submissions</h2>
        </div>

        {enquiries.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-10 text-center text-sm text-white0">
            No enquiries yet. Share the form link above to get started.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-[#2A2A3A]">
            <table className="min-w-full divide-y divide-[#2A2A3A] text-left">
              <thead className="bg-[#13131E] text-xs uppercase tracking-[0.18em] text-white0">
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
              <tbody className="divide-y divide-[#2A2A3A] bg-[#13131E] text-sm text-[#9CA3AF]">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td className="px-4 py-4 font-medium text-white">{enquiry.biz_name}</td>
                    <td className="px-4 py-4">{enquiry.contact_name}</td>
                    <td className="px-4 py-4 text-[#9CA3AF]">
                      {enquiry.contact_email ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-[#9CA3AF]">
                      {enquiry.contact_phone ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-[#9CA3AF]">
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
                        className="inline-flex rounded-full border border-[#2A2A3A] px-3 py-1.5 text-xs font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40 hover:text-white"
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
            className="text-sm font-medium text-[#9CA3AF] transition hover:text-white"
          >
            View all enquiries →
          </Link>
        </div>
      </section>
    </div>
  )
}
