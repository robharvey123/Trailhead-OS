import Link from 'next/link'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getQuotes } from '@/lib/db/quotes'
import { createClient } from '@/lib/supabase/server'

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Commercial</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Quotes</h1>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          New quote
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sent quote value</p>
          <p className="mt-3 text-2xl font-semibold text-slate-50">{formatMoney(sentValue)}</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Accepted this month</p>
          <p className="mt-3 text-2xl font-semibold text-slate-50">{acceptedThisMonth}</p>
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
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        {quotes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No quotes in this view yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Quote no.</th>
                <th className="pb-3">Title</th>
                <th className="pb-3">Account</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Workstream</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-t border-slate-800">
                  <td className="py-4 font-medium text-slate-100">{quote.quote_number}</td>
                  <td className="py-4 text-slate-300">{quote.title}</td>
                  <td className="py-4 text-slate-300">{quote.account_name ?? '—'}</td>
                  <td className="py-4 text-slate-300">{quote.contact_name ?? '—'}</td>
                  <td className="py-4">
                    {quote.workstream ? (
                      <WorkstreamBadge
                        label={quote.workstream.label}
                        slug={quote.workstream.label}
                        colour={quote.workstream.colour}
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-4 text-right font-medium text-slate-100">{formatMoney(quote.totals.total)}</td>
                  <td className="py-4">
                    <StatusBadge status={quote.status} kind="quote" />
                  </td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-3">
                      <Link href={`/quotes/${quote.id}`} className="text-sky-300 hover:text-sky-200">
                        View
                      </Link>
                      <a href={`/api/quotes/${quote.id}/pdf`} className="text-slate-300 hover:text-white">
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
