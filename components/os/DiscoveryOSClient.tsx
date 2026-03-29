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
  const publicUrl = 'https://app.trailheadholdings.uk/discovery'

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
    window.open(publicUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Clients</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">Discovery form</h1>
        <p className="mt-2 text-sm text-slate-400">
          Send this link to clients to capture their app requirements.
        </p>
      </div>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Public form URL</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenForm}
                  className="rounded-2xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-400 hover:bg-slate-800"
                >
                  Open form
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((current) => !current)}
                  className="rounded-2xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-400 hover:bg-slate-800"
                >
                  {showPreview ? 'Hide preview' : 'Preview'}
                </button>
              </div>
            </div>
          </div>

          {showPreview ? (
            <iframe
              src="/discovery"
              title="Discovery form preview"
              className="mt-4 w-full rounded-lg border border-gray-200"
              style={{ height: '600px' }}
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-50">Recent submissions</h2>
        </div>

        {enquiries.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No enquiries yet. Share the form link above to get started.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-left">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.18em] text-slate-500">
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
              <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-sm text-slate-200">
                {enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td className="px-4 py-4 font-medium text-slate-50">{enquiry.biz_name}</td>
                    <td className="px-4 py-4">{enquiry.contact_name}</td>
                    <td className="px-4 py-4 text-slate-300">
                      {enquiry.contact_email ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {enquiry.contact_phone ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-slate-400">
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
                        className="inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
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
            className="text-sm font-medium text-slate-300 transition hover:text-white"
          >
            View all enquiries →
          </Link>
        </div>
      </section>
    </div>
  )
}
