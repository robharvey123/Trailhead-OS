'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { formatMoney } from '@/lib/money'
import { roundMoney, type InvoicePayment, type InvoicePaymentMethod, type InvoiceStatus } from '@/lib/types'

// The payments ledger card on the invoice detail page. Dates are freely
// editable — recording a payment from three weeks ago is the normal case, not
// the exception. Status and paid_at are re-derived server-side on every change.

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  stripe: 'Stripe',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
}

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputClass = 'os-input w-full'

export default function InvoicePayments({
  invoiceId,
  currency,
  total,
  initialPayments,
  status,
  recordOpen,
  onRecordOpenChange,
}: {
  invoiceId: string
  currency: string
  total: number
  initialPayments: InvoicePayment[]
  status: InvoiceStatus
  recordOpen: boolean
  onRecordOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [payments, setPayments] = useState(initialPayments)
  const [editing, setEditing] = useState<InvoicePayment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
  const balance = roundMoney(total - amountPaid)
  const canRecord = status !== 'draft' && status !== 'cancelled' && balance > 0

  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<InvoicePaymentMethod>('bank_transfer')
  const [reference, setReference] = useState('')

  function openModal(payment?: InvoicePayment) {
    setError(null)
    if (payment) {
      setEditing(payment)
      setPaidOn(payment.paid_on)
      setAmount(String(payment.amount))
      setMethod(payment.method ?? 'bank_transfer')
      setReference(payment.reference ?? '')
    } else {
      setEditing(null)
      setPaidOn(new Date().toISOString().slice(0, 10))
      setAmount(balance > 0 ? String(balance.toFixed(2)) : '')
      setMethod('bank_transfer')
      setReference('')
    }
    onRecordOpenChange(true)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const body = { paid_on: paidOn, amount: Number(amount), method, reference: reference || null }
      const url = editing ? `/api/invoices/${invoiceId}/payments/${editing.id}` : `/api/invoices/${invoiceId}/payments`
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save payment')
      const payment = data.payment as InvoicePayment
      setPayments((cur) => {
        const next = editing ? cur.map((p) => (p.id === payment.id ? { ...payment, amount: Number(payment.amount) } : p)) : [...cur, { ...payment, amount: Number(payment.amount) }]
        return [...next].sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at))
      })
      onRecordOpenChange(false)
      toast.success(editing ? 'Payment updated' : 'Payment recorded')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment')
    } finally {
      setBusy(false)
    }
  }

  async function remove(payment: InvoicePayment) {
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments/${payment.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to delete payment')
      setPayments((cur) => cur.filter((p) => p.id !== payment.id))
      toast.success('Payment deleted')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete payment'
      setError(message)
      toast.error(message)
    }
  }

  return (
    <div className="os-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="os-section-title">Payments</h2>
        {canRecord ? (
          <button
            type="button"
            onClick={() => openModal()}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Record payment
          </button>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[1.5rem] border border-[color:var(--border)] bg-[var(--surface-2)] p-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">Total</dt>
          <dd className="mt-1 font-medium text-[color:var(--text)]">{formatMoney(total, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">Paid</dt>
          <dd className="mt-1 font-medium text-[color:var(--text)]">{formatMoney(amountPaid, currency)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">Balance outstanding</dt>
          <dd className={`mt-1 font-bold ${balance > 0 ? 'text-[color:var(--amber-strong)]' : 'text-[color:var(--emerald-strong)]'}`}>
            {formatMoney(balance, currency)}
          </dd>
        </div>
      </dl>

      {payments.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--text-3)]">No payments recorded yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2">Method</th>
                <th className="pb-2">Reference</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2.5 text-[color:var(--text)]">{fmtDate(p.paid_on)}</td>
                  <td className="py-2.5 text-right font-medium text-[color:var(--text)]">{formatMoney(p.amount, p.currency)}</td>
                  <td className="py-2.5 text-[color:var(--text-2)]">{p.method ? METHOD_LABELS[p.method] : '—'}</td>
                  <td className="py-2.5 text-[color:var(--text-2)]">{p.reference ?? '—'}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      <button type="button" className="text-[color:var(--accent-strong)] hover:underline" onClick={() => openModal(p)}>
                        Edit
                      </button>
                      <button type="button" className="text-[color:var(--red-strong)] hover:underline" onClick={() => void remove(p)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && !recordOpen ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      {recordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <h2 className="os-section-title">{editing ? 'Edit payment' : 'Record payment'}</h2>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Payment date</span>
                <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Amount ({currency})</span>
                <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)} className="os-select w-full">
                  {(Object.keys(METHOD_LABELS) as InvoicePaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Reference</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank reference, remittance…" className={inputClass} />
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onRecordOpenChange(false)}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
