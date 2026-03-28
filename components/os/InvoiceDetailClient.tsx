'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { calculateTotals, type Contact, type Invoice, type InvoiceStatus, type Workstream } from '@/lib/types'
import WorkstreamBadge from './WorkstreamBadge'
import StatusBadge from './StatusBadge'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function InvoiceDetailClient({
  invoice,
  contact,
  workstream,
  warning,
}: {
  invoice: Invoice
  contact: Contact | null
  workstream: Workstream | null
  warning?: string | null
}) {
  const router = useRouter()
  const [updatingStatus, setUpdatingStatus] = useState<InvoiceStatus | 'cancelled' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)

  async function updateStatus(nextStatus: InvoiceStatus) {
    setUpdatingStatus(nextStatus)
    setError(null)

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update invoice')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice')
    } finally {
      setUpdatingStatus(null)
    }
  }

  async function cancelInvoice() {
    if (!window.confirm('Cancel this invoice?')) {
      return
    }

    await updateStatus('cancelled')
  }

  return (
    <div className="space-y-6">
      {warning === 'edit-blocked' ? (
        <div className="rounded-[1.75rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Only draft invoices can be edited. You were redirected back to the detail view.
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Invoice</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">
              {invoice.invoice_number}
            </h1>
            <div className="mt-4">
              <StatusBadge status={invoice.status} kind="invoice" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
            >
              Download PDF
            </a>
            {invoice.status === 'draft' ? (
              <Link
                href={`/invoicing/${invoice.id}/edit`}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Issue date</p>
            <p className="mt-2 text-sm text-slate-200">{invoice.issue_date}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Due date</p>
            <p className="mt-2 text-sm text-slate-200">{invoice.due_date ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Client</p>
            <p className="mt-2 text-sm text-slate-200">{contact?.name ?? '—'}</p>
            {contact?.company ? (
              <p className="mt-1 text-sm text-slate-400">{contact.company}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workstream</p>
            <div className="mt-2">
              {workstream ? (
                <WorkstreamBadge
                  label={workstream.label}
                  slug={workstream.slug}
                  colour={workstream.colour}
                />
              ) : (
                <p className="text-sm text-slate-200">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Line items</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit price</th>
                <th className="pb-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item) => (
                <tr key={item.id} className="border-t border-slate-800">
                  <td className="py-3 text-slate-100">{item.description}</td>
                  <td className="py-3 text-right text-slate-300">{item.qty}</td>
                  <td className="py-3 text-right text-slate-300">{formatMoney(item.unit_price)}</td>
                  <td className="py-3 text-right text-slate-100">
                    {formatMoney(item.qty * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {invoice.notes ? (
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-300">{invoice.notes}</p>
          </div>
        ) : (
          <div />
        )}

        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">Subtotal</dt>
              <dd className="font-medium text-slate-100">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-400">VAT ({invoice.vat_rate}%)</dt>
              <dd className="font-medium text-slate-100">{formatMoney(totals.vat_amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
              <dt className="text-base font-semibold text-slate-100">Total</dt>
              <dd className="text-lg font-semibold text-white">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-slate-100">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {invoice.status === 'draft' ? (
            <>
              <button
                type="button"
                onClick={() => updateStatus('sent')}
                disabled={updatingStatus !== null}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {updatingStatus === 'sent' ? 'Updating...' : 'Mark as sent'}
              </button>
              <button
                type="button"
                onClick={cancelInvoice}
                disabled={updatingStatus !== null}
                className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
              >
                Cancel invoice
              </button>
            </>
          ) : null}
          {invoice.status === 'sent' ? (
            <>
              <button
                type="button"
                onClick={() => updateStatus('paid')}
                disabled={updatingStatus !== null}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
              >
                {updatingStatus === 'paid' ? 'Updating...' : 'Mark as paid'}
              </button>
              <button
                type="button"
                onClick={() => updateStatus('overdue')}
                disabled={updatingStatus !== null}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
              >
                {updatingStatus === 'overdue' ? 'Updating...' : 'Mark as overdue'}
              </button>
              <button
                type="button"
                onClick={cancelInvoice}
                disabled={updatingStatus !== null}
                className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
              >
                Cancel invoice
              </button>
            </>
          ) : null}
          {invoice.status === 'overdue' ? (
            <button
              type="button"
              onClick={() => updateStatus('paid')}
              disabled={updatingStatus !== null}
              className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
            >
              {updatingStatus === 'paid' ? 'Updating...' : 'Mark as paid'}
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  )
}
