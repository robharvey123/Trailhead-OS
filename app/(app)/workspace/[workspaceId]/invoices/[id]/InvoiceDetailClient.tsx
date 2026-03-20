'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { currencySymbol } from '@/lib/format'
import type {
  FinanceInvoice,
  FinancePayment,
  PaymentMethod,
  PaymentAccountType,
  CompanyDetails,
} from '@/lib/finance/types'
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_ACCOUNT_TYPES,
  PAYMENT_ACCOUNT_TYPE_LABELS,
} from '@/lib/finance/types'

export default function InvoiceDetailClient({
  workspaceId,
  invoice: initialInvoice,
  accountName,
  payments: initialPayments,
  companyDetails,
  baseCurrency,
  supportedCurrencies,
}: {
  workspaceId: string
  invoice: FinanceInvoice
  accountName: string | null
  payments: FinancePayment[]
  companyDetails: CompanyDetails
  baseCurrency: string
  supportedCurrencies: string[]
}) {
  const [invoice, setInvoice] = useState(initialInvoice)
  const [payments, setPayments] = useState(initialPayments)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Payment form fields
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')
  const [payAccountType, setPayAccountType] = useState<PaymentAccountType>('bank')
  const [payReference, setPayReference] = useState('')
  const [payNotes, setPayNotes] = useState('')

  const cur = invoice.currency || baseCurrency
  const fmtCur = (v: number) => {
    const sym = currencySymbol(cur)
    return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const balanceDue = invoice.total - invoice.amount_paid

  const resetPaymentForm = () => {
    setPayAmount('')
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayMethod('')
    setPayAccountType('bank')
    setPayReference('')
    setPayNotes('')
  }

  const handleRecordPayment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const amount = parseFloat(payAmount)
      if (!amount || amount <= 0) throw new Error('Enter a valid amount')

      const { payment } = await apiFetch<{ payment: FinancePayment }>('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          invoice_id: invoice.id,
          amount,
          currency: cur,
          method: payMethod || null,
          account_type: payAccountType,
          reference_number: payReference || null,
          payment_date: payDate,
          notes: payNotes || null,
        }),
      })

      setPayments((prev) => [payment, ...prev])

      // Refresh invoice to get updated amount_paid and status
      const newTotalPaid = invoice.amount_paid + amount
      const newStatus = newTotalPaid >= invoice.total ? 'paid' : 'partial'
      setInvoice((prev) => ({ ...prev, amount_paid: newTotalPaid, status: newStatus }))

      resetPaymentForm()
      setShowPaymentForm(false)
      toast.success('Payment recorded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, invoice.id, invoice.total, invoice.amount_paid, payAmount, payDate, payMethod, payAccountType, payReference, payNotes, cur])

  const hasCompany = companyDetails.company_name || companyDetails.company_address

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/workspace/${workspaceId}/invoices`} className="text-xs text-slate-400 hover:text-white">&larr; Back to invoices</Link>
          <h1 className="mt-2 text-2xl font-semibold">Invoice #{invoice.invoice_number}</h1>
          <div className="mt-1 flex items-center gap-3">
            <span className={`text-sm ${INVOICE_STATUS_COLORS[invoice.status]}`}>{INVOICE_STATUS_LABELS[invoice.status]}</span>
            <span className="text-sm text-slate-400">{invoice.direction === 'incoming' ? '↓ Incoming' : '↑ Outgoing'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {balanceDue > 0 && (
            <button
              onClick={() => { resetPaymentForm(); setPayAmount(balanceDue.toFixed(2)); setShowPaymentForm(true) }}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-emerald-500"
            >
              Record Payment
            </button>
          )}
          <a
            href={`/api/finance/invoices/${invoice.id}/pdf`}
            download
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-white"
          >
            Download PDF
          </a>
        </div>
      </div>

      {/* Invoice Details Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: From / To */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-6">
          {hasCompany && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">From</p>
              {companyDetails.company_name && <p className="font-semibold">{companyDetails.company_name}</p>}
              {companyDetails.company_address && <p className="text-sm text-slate-300">{companyDetails.company_address}</p>}
              {(companyDetails.company_city || companyDetails.company_postcode) && (
                <p className="text-sm text-slate-300">
                  {[companyDetails.company_city, companyDetails.company_postcode].filter(Boolean).join(', ')}
                </p>
              )}
              {companyDetails.company_country && <p className="text-sm text-slate-300">{companyDetails.company_country}</p>}
              {companyDetails.company_email && <p className="mt-1 text-sm text-slate-400">{companyDetails.company_email}</p>}
              {companyDetails.company_phone && <p className="text-sm text-slate-400">{companyDetails.company_phone}</p>}
              {companyDetails.company_vat_number && <p className="text-sm text-slate-400">VAT: {companyDetails.company_vat_number}</p>}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">{invoice.direction === 'outgoing' ? 'Bill To' : 'Received From'}</p>
            <p className="font-semibold">{accountName || '—'}</p>
          </div>
        </div>

        {/* Right: Meta */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Issue Date</p>
              <p className="mt-1">{invoice.issue_date}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Due Date</p>
              <p className="mt-1">{invoice.due_date || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Currency</p>
              <p className="mt-1">{cur}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment Terms</p>
              <p className="mt-1">{invoice.payment_terms || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items || []).length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No line items</td></tr>
            ) : (invoice.line_items || []).map((item, i) => (
              <tr key={item.id || i} className="border-b border-slate-800/50">
                <td className="px-4 py-3">{item.description || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-300">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-slate-300">{fmtCur(item.unit_price)}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtCur(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{fmtCur(invoice.subtotal)}</span></div>
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between"><span className="text-slate-400">Discount</span><span>-{fmtCur(invoice.discount_amount)}</span></div>
          )}
          {invoice.tax_rate > 0 && (
            <div className="flex justify-between"><span className="text-slate-400">Tax ({invoice.tax_rate}%)</span><span>{fmtCur(invoice.tax_amount)}</span></div>
          )}
          <div className="flex justify-between border-t border-slate-700 pt-2 text-base font-semibold"><span>Total</span><span>{fmtCur(invoice.total)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Paid</span><span className="text-emerald-400">{fmtCur(invoice.amount_paid)}</span></div>
          {balanceDue > 0 && (
            <div className="flex justify-between font-semibold text-rose-400"><span>Balance Due</span><span>{fmtCur(balanceDue)}</span></div>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Notes</p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Record Payment Form */}
      {showPaymentForm && (
        <div className="rounded-2xl border border-emerald-900/50 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <form onSubmit={handleRecordPayment} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Amount *</label>
              <input required type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Payment Date</label>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Account Type *</label>
              <select value={payAccountType} onChange={(e) => setPayAccountType(e.target.value as PaymentAccountType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {PAYMENT_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{PAYMENT_ACCOUNT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Payment Method</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option value="">Select method...</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Reference Number</label>
              <input value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. CHQ-001 or TXN-123" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase text-white hover:bg-emerald-500 disabled:opacity-50">{saving ? 'Saving...' : 'Record Payment'}</button>
              <button type="button" onClick={() => { setShowPaymentForm(false); resetPaymentForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Payment History</h2>
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-500">
            No payments recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">{p.payment_date}</td>
                    <td className="px-4 py-3 font-medium text-emerald-400">{fmtCur(p.amount)}</td>
                    <td className="px-4 py-3 text-slate-400">{p.account_type === 'cash' ? 'Cash' : 'Bank'}</td>
                    <td className="px-4 py-3 text-slate-400">{p.method ? PAYMENT_METHOD_LABELS[p.method] : '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{p.reference_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
