import Link from 'next/link'
import InvoiceAccountFilter from '@/components/os/InvoiceAccountFilter'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getInvoices } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import { calculateTotals, roundMoney, type InvoiceStatus } from '@/lib/types'
import { formatMoney } from '@/lib/money'

const INVOICE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'part_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

const STATUS_VALUES = new Set<InvoiceStatus>(['draft', 'sent', 'part_paid', 'paid', 'overdue', 'cancelled'])


function getStripeState(invoice: Awaited<ReturnType<typeof getInvoices>>[number]) {
  if (invoice.paid_at || invoice.status === 'paid') {
    return (
      <span className="rounded-full border border-[color:var(--emerald)] bg-[var(--emerald-dim)] px-3 py-1 text-xs font-medium text-[color:var(--emerald-strong)]">
        Paid
      </span>
    )
  }

  if (invoice.is_recurring) {
    return (
      <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]">
        Recurring
      </span>
    )
  }

  if (invoice.stripe_payment_link) {
    return (
      <span className="rounded-full border border-[color:var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
        Link sent
      </span>
    )
  }

  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--surface-3)]" />
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; account?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const activeAccount = resolvedSearchParams?.account ?? ''
  const supabase = await createClient()
  const [invoices, contacts, accounts, workstreams] = await Promise.all([
    getInvoices(
      {
        status: STATUS_VALUES.has(activeStatus as InvoiceStatus) ? (activeStatus as InvoiceStatus) : undefined,
        account_id: activeAccount || undefined,
      },
      supabase
    ).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  // Payments per invoice so the headline is BALANCES, not totals — a part
  // payment reduces Outstanding by exactly the amount paid.
  const paidByInvoice = new Map<string, number>()
  if (invoices.length) {
    const { data: paymentRows } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount')
      .in('invoice_id', invoices.map((i) => i.id))
    for (const p of (paymentRows ?? []) as Array<{ invoice_id: string; amount: number }>) {
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount))
    }
  }

  // Sum GBP equivalents — invoices may be in different currencies, so summing
  // native totals would add pounds to dollars. The headline figure is GBP.
  const outstandingAmount = invoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'part_paid' || invoice.status === 'overdue')
    .reduce((sum, invoice) => {
      const balance = roundMoney(
        calculateTotals(invoice.line_items, invoice.vat_rate).total - (paidByInvoice.get(invoice.id) ?? 0)
      )
      return sum + Math.max(balance, 0) * (invoice.fx_rate_to_gbp ?? 1)
    }, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">Finance</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="os-page-title">Invoicing</h1>
            <span className="rounded-full border border-[color:var(--amber)] bg-[var(--amber-dim)] px-3 py-1 text-sm font-medium text-[color:var(--amber-strong)]">
              Outstanding {formatMoney(outstandingAmount, 'GBP')}
            </span>
          </div>
        </div>
        <Link
          href="/invoicing/new"
          className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          New invoice
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {INVOICE_TABS.map((tab) => {
          const params = new URLSearchParams()
          if (tab.value !== 'all') params.set('status', tab.value)
          if (activeAccount) params.set('account', activeAccount)
          const qs = params.toString()
          const href = qs ? `/invoicing?${qs}` : '/invoicing'
          const active = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                  : 'border-[color:var(--border)] text-[color:var(--text-2)] hover:border-[color:var(--border-light)] hover:text-[color:var(--text)]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
        <div className="ml-auto">
          <InvoiceAccountFilter accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} value={activeAccount} />
        </div>
      </div>

      <div className="os-card p-6">
        {invoices.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No invoices in this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
                <tr>
                  <th className="pb-3">Invoice no.</th>
                  <th className="pb-3">Client</th>
                  <th className="pb-3">Workstream</th>
                  <th className="pb-3">Issue date</th>
                  <th className="pb-3">Due date</th>
                  <th className="pb-3 text-right">Total</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Stripe</th>
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
                    <tr key={invoice.id} className="border-t border-[color:var(--border)]">
                      <td className="py-4 font-medium text-[color:var(--text)]">{invoice.invoice_number}</td>
                      <td className="py-4 text-[color:var(--text-2)]">
                        {contact ? (
                          <>
                            <p>{invoice.bill_to_name ?? contact.name}</p>
                            {contact.company ? (
                              <p className="text-xs text-[color:var(--text-3)]">{contact.company}</p>
                            ) : null}
                          </>
                        ) : invoice.bill_to_name ? (
                          <>
                            <p>{invoice.bill_to_name}</p>
                            {invoice.bill_to_address ? (
                              <p className="text-xs text-[color:var(--text-3)] line-clamp-2 whitespace-pre-wrap">
                                {invoice.bill_to_address}
                              </p>
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
                          <span className="text-[color:var(--text-2)]">—</span>
                        )}
                      </td>
                      <td className="py-4 text-[color:var(--text-2)]">{invoice.issue_date}</td>
                      <td className="py-4 text-[color:var(--text-2)]">{invoice.due_date ?? '—'}</td>
                      <td className="py-4 text-right font-medium text-[color:var(--text)]">
                        {formatMoney(totals.total, invoice.currency)}
                        {invoice.status === 'part_paid' ? (
                          <p className="text-xs font-normal text-[color:var(--amber-strong)]">
                            {formatMoney(roundMoney(totals.total - (paidByInvoice.get(invoice.id) ?? 0)), invoice.currency)} outstanding
                          </p>
                        ) : null}
                      </td>
                      <td className="py-4">
                        <StatusBadge status={invoice.status} kind="invoice" />
                      </td>
                      <td className="py-4">{getStripeState(invoice)}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/invoicing/${invoice.id}`}
                            className="text-[color:var(--accent-strong)] hover:text-[color:var(--accent-hover)]"
                          >
                            View
                          </Link>
                          <a
                            href={`/api/invoices/${invoice.id}/pdf`}
                            className="text-[color:var(--text-2)] hover:text-[color:var(--text)]"
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
