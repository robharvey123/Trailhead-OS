'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { StripePayment, StripePaymentStatus } from '@/lib/holding/types'

const STATUS_COLORS: Record<StripePaymentStatus, string> = {
  succeeded: 'text-emerald-400',
  pending: 'text-amber-400',
  failed: 'text-rose-400',
  refunded: 'text-slate-400',
}

const fmtCurrency = (v: number) =>
  `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PaymentsClient({ workspaceId }: { workspaceId: string }) {
  const [payments, setPayments] = useState<StripePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ payments: StripePayment[] }>(
        `/api/holding/stripe-payments?workspace_id=${workspaceId}`
      )
      setPayments(res.payments)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await apiFetch<{ synced: number }>(`/api/integrations/stripe/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      toast.success(`Synced ${res.synced} payments from Stripe`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally { setSyncing(false) }
  }

  const filtered = payments.filter((p) => filterStatus === 'all' || p.status === filterStatus)
  const totalSucceeded = filtered.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0)
  const totalRefunded = filtered.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-1 text-2xl font-semibold">Stripe Payments</h1>
          <p className="mt-1 text-sm text-slate-400">
            Revenue: {fmtCurrency(totalSucceeded)} &middot; Refunded: {fmtCurrency(totalRefunded)}
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync from Stripe'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Succeeded</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-400">
            {fmtCurrency(payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0))}
          </p>
          <p className="mt-1 text-xs text-slate-500">{payments.filter((p) => p.status === 'succeeded').length} payments</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending</p>
          <p className="mt-3 text-2xl font-semibold text-amber-400">
            {fmtCurrency(payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}
          </p>
          <p className="mt-1 text-xs text-slate-500">{payments.filter((p) => p.status === 'pending').length} payments</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Payments</p>
          <p className="mt-3 text-2xl font-semibold text-white">{payments.length}</p>
        </div>
      </section>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No payments found. Use &quot;Sync from Stripe&quot; to import.</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-400">{p.payment_date}</td>
                  <td className="px-4 py-3 font-medium">{p.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.customer_email || '—'}</td>
                  <td className="px-4 py-3 font-medium">{fmtCurrency(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs capitalize ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
