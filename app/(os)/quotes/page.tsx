import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getQuotes } from '@/lib/db/quotes'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Quotes' }

const QUOTE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'converted', label: 'Converted' },
] as const

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const supabase = await createClient()
  const quotes = await getQuotes(
    {
      status:
        activeStatus === 'draft' ||
        activeStatus === 'sent' ||
        activeStatus === 'accepted' ||
        activeStatus === 'declined' ||
        activeStatus === 'converted'
          ? activeStatus
          : undefined,
    },
    supabase
  ).catch(() => [])

  const sentValue = quotes
    .filter((quote) => quote.status === 'sent')
    .reduce((sum, quote) => sum + quote.totals.total, 0)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const acceptedThisMonth = quotes.filter(
    (quote) => quote.status === 'accepted' && quote.updated_at.slice(0, 7) === currentMonth
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commercial"
        title="Quotes"
        actions={
          <Link
            href="/quotes/new"
            className="btn btn-primary"
          >
            New quote
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="os-card p-5">
          <p className="os-eyebrow">Sent quote value</p>
          <p className="stat-value mt-3">{formatMoney(sentValue)}</p>
        </div>
        <div className="os-card p-5">
          <p className="os-eyebrow">Accepted this month</p>
          <p className="stat-value mt-3">{acceptedThisMonth}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUOTE_TABS.map((tab) => {
          const href = tab.value === 'all' ? '/quotes' : `/quotes?status=${tab.value}`
          const active = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-pill border px-4 py-2 text-sm transition ${
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

      <div className="os-card overflow-x-auto p-6">
        {quotes.length === 0 ? (
          <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No quotes in this view yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left">
              <tr>
                <th className="os-label pb-3">Quote no.</th>
                <th className="os-label pb-3">Title</th>
                <th className="os-label pb-3">Account</th>
                <th className="os-label pb-3">Contact</th>
                <th className="os-label pb-3">Workstream</th>
                <th className="os-label pb-3 text-right">Total</th>
                <th className="os-label pb-3">Status</th>
                <th className="os-label pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-t border-[color:var(--border)]">
                  <td className="py-4 font-medium text-[color:var(--text)]">{quote.quote_number}</td>
                  <td className="py-4 text-[color:var(--text-2)]">{quote.title}</td>
                  <td className="py-4 text-[color:var(--text-2)]">{quote.account_name ?? '—'}</td>
                  <td className="py-4 text-[color:var(--text-2)]">{quote.contact_name ?? '—'}</td>
                  <td className="py-4">
                    {quote.workstream ? (
                      <WorkstreamBadge
                        label={quote.workstream.label}
                        slug={quote.workstream.label}
                        colour={quote.workstream.colour}
                      />
                    ) : (
                      <span className="text-[color:var(--text-2)]">—</span>
                    )}
                  </td>
                  <td className="py-4 text-right font-medium text-[color:var(--text)]">{formatMoney(quote.totals.total)}</td>
                  <td className="py-4">
                    <StatusBadge status={quote.status} kind="quote" />
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/quotes/${quote.id}`} className="text-[color:var(--accent-strong)] hover:text-[color:var(--accent-hover)]">
                        View
                      </Link>
                      <a href={`/api/quotes/${quote.id}/pdf`} className="text-[color:var(--text-2)] hover:text-[color:var(--text)]">
                        Download PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
