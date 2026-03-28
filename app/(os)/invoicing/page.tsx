import Link from 'next/link'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getContacts } from '@/lib/db/contacts'
import { getInvoices } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import { calculateTotals } from '@/lib/types'

const INVOICE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const supabase = await createClient()
  const [invoices, contacts, workstreams] = await Promise.all([
    getInvoices(
      {
        status:
          activeStatus === 'draft' ||
          activeStatus === 'sent' ||
          activeStatus === 'paid' ||
          activeStatus === 'overdue' ||
          activeStatus === 'cancelled'
            ? activeStatus
            : undefined,
      },
      supabase
    ).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  const outstandingAmount = invoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'overdue')
    .reduce((sum, invoice) => sum + calculateTotals(invoice.line_items, invoice.vat_rate).total, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Finance</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-50">Invoicing</h1>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
              Outstanding {formatMoney(outstandingAmount)}
            </span>
          </div>
        </div>
        <Link
          href="/invoicing/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          New invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {INVOICE_TABS.map((tab) => {
          const href = tab.value === 'all' ? '/invoicing' : `/invoicing?status=${tab.value}`
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

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        {invoices.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No invoices in this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="pb-3">Invoice no.</th>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Workstream</th>
                  <th className="pb-3">Issue date</th>
                  <th className="pb-3">Due date</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const contact =
                    contacts.find((item) => item.id === invoice.contact_id) ?? null
                  const workstream =
                    workstreams.find((item) => item.id === invoice.workstream_id) ?? null
                  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)

                  return (
                    <tr key={invoice.id} className="border-t border-slate-800">
                      <td className="py-4 font-medium text-slate-100">{invoice.invoice_number}</td>
                      <td className="py-4 text-slate-300">
                        {contact ? (
                          <>
                            <p>{contact.name}</p>
                            {contact.company ? (
                              <p className="text-xs text-slate-500">{contact.company}</p>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-4">
                        {workstream ? (
                          <WorkstreamBadge
                            label={workstream.label}
                            slug={workstream.slug}
                            colour={workstream.colour}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-300">{invoice.issue_date}</td>
                      <td className="py-4 text-slate-300">{invoice.due_date ?? '—'}</td>
                      <td className="py-4 text-right font-medium text-slate-100">
                        {formatMoney(totals.total)}
                      </td>
                      <td className="py-4">
                        <StatusBadge status={invoice.status} kind="invoice" />
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/invoicing/${invoice.id}`}
                            className="text-sky-300 hover:text-sky-200"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/invoices/${invoice.id}/pdf`}
                            className="text-slate-300 hover:text-white"
                          >
                            Download PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
