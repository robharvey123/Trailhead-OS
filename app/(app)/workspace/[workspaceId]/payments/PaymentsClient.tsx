'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { currencySymbol } from '@/lib/format'
import type { FinancePayment, PaymentAccountType, PaymentMethod } from '@/lib/finance/types'
import { PAYMENT_ACCOUNT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/finance/types'

export default function PaymentsClient({
  workspaceId,
  initialPayments,
  invoiceMap,
  baseCurrency,
}: {
  workspaceId: string
  initialPayments: FinancePayment[]
  invoiceMap: Record<string, string>
  baseCurrency: string
}) {
  const [payments] = useState(initialPayments)
  const [filterAccountType, setFilterAccountType] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [search, setSearch] = useState('')

  const fmtCur = (v: number, code?: string) => {
    const sym = currencySymbol(code || baseCurrency)
    return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filterAccountType !== 'all' && p.account_type !== filterAccountType) return false
      if (filterMethod !== 'all' && p.method !== filterMethod) return false
      if (search) {
        const q = search.toLowerCase()
        const invNum = p.invoice_id ? invoiceMap[p.invoice_id] || '' : ''
        if (!invNum.toLowerCase().includes(q) && !(p.reference_number || '').toLowerCase().includes(q) && !(p.notes || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [payments, filterAccountType, filterMethod, search, invoiceMap])

  const totals = useMemo(() => ({
    total: filtered.reduce((s, p) => s + p.amount, 0),
    bank: filtered.filter((p) => p.account_type === 'bank').reduce((s, p) => s + p.amount, 0),
    cash: filtered.filter((p) => p.account_type === 'cash').reduce((s, p) => s + p.amount, 0),
  }), [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold">Payments</h1>
          <p className="mt-1 text-sm text-slate-400">
            Total: {fmtCur(totals.total)} &middot; Bank: {fmtCur(totals.bank)} &middot; Cash: {fmtCur(totals.cash)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, invoice…" className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/30" />
        <select value={filterAccountType} onChange={(e) => setFilterAccountType(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Accounts</option>
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
        </select>
        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Methods</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="credit_card">Credit Card</option>
          <option value="check">Check</option>
          <option value="cash">Cash</option>
          <option value="paypal">PayPal</option>
          <option value="stripe">Stripe</option>
          <option value="other">Other</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-16">
          <div className="mb-3 text-4xl text-slate-600">💳</div>
          <p className="text-slate-400">No payments recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">Payments are recorded from invoice detail pages</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((p) => (
                <tr key={p.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">{p.payment_date}</td>
                  <td className="px-4 py-3">
                    {p.invoice_id ? (
                      <Link href={`/workspace/${workspaceId}/invoices/${p.invoice_id}`} className="text-blue-400 hover:underline">
                        {invoiceMap[p.invoice_id] || 'View'}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtCur(p.amount, p.currency)}</td>
                  <td className="px-4 py-3">{PAYMENT_ACCOUNT_TYPE_LABELS[p.account_type as PaymentAccountType] || p.account_type}</td>
                  <td className="px-4 py-3">{p.method ? PAYMENT_METHOD_LABELS[p.method as PaymentMethod] || p.method : '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.reference_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-48 truncate">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
