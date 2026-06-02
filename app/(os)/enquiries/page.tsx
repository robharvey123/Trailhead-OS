import Link from 'next/link'
import { getEnquiries } from '@/lib/db/enquiries'
import { getQuotes } from '@/lib/db/quotes'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/os/StatusBadge'
import type { EnquiryStatus } from '@/lib/types'

const ENQUIRY_TABS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'received', label: 'Received' },
  { value: 'under_review', label: 'Under review' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'closed', label: 'Closed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'converted', label: 'Converted' },
] as const

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const supabase = await createClient()
  const supportedStatuses = new Set<EnquiryStatus>([
    'new',
    'received',
    'under_review',
    'quoted',
    'closed',
    'reviewed',
    'converted',
  ])
  const [enquiries, quotes] = await Promise.all([
    getEnquiries(
      {
        status: supportedStatuses.has(activeStatus as EnquiryStatus)
          ? activeStatus as EnquiryStatus
          : undefined,
      },
      supabase
    ).catch(() => []),
    getQuotes({}, supabase).catch(() => []),
  ])
  const latestQuoteByEnquiryId = new Map(
    quotes.filter((quote) => quote.enquiry_id).map((quote) => [quote.enquiry_id as string, quote])
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">Clients</p>
          <h1 className="mt-2 os-page-title">Enquiries</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Discovery form submissions waiting for review or conversion.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENQUIRY_TABS.map((tab) => {
          const href = tab.value === 'all' ? '/enquiries' : `/enquiries?status=${tab.value}`
          const active = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                  : 'border-[color:var(--border)] text-[color:var(--text-2)] hover:border-[color:var(--accent)] hover:text-[color:var(--text)]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="os-card p-6">
        {enquiries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No enquiries in this view yet.
          </div>
        ) : (
          <div className="space-y-3">
            {enquiries.map((enquiry) => (
              <Link
                key={enquiry.id}
                href={`/enquiries/${enquiry.id}`}
                className="block rounded-3xl border border-[color:var(--border)] bg-white p-5 transition hover:border-[color:var(--border-light)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--text)]">{enquiry.biz_name}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">
                      {enquiry.contact_name} · {new Date(enquiry.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={enquiry.status} kind="enquiry" />
                    {latestQuoteByEnquiryId.get(enquiry.id) ? (
                      <span className="rounded-full border border-[color:var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
                        Quote {latestQuoteByEnquiryId.get(enquiry.id)?.status}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm text-[color:var(--text-2)]">
                  {enquiry.pain_points || enquiry.extra || 'Open to view full submission details.'}
                </p>
                {latestQuoteByEnquiryId.get(enquiry.id) ? (
                  <p className="mt-3 text-xs text-[color:var(--accent-strong)]">
                    Latest quote: {latestQuoteByEnquiryId.get(enquiry.id)?.quote_number} · {latestQuoteByEnquiryId.get(enquiry.id)?.title}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
