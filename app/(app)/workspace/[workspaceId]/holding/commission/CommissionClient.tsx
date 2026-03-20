'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { CommissionRate, CommissionEarning, CommissionType, IncomeStream } from '@/lib/holding/types'

type EarningsSummary = {
  total_earned: number
  by_brand: { brand: string; earned: number }[]
  by_month: { month: string; earned: number }[]
}

const fmtCurrency = (v: number) =>
  `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CommissionClient({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<'rates' | 'earnings'>('rates')

  // Rates state
  const [rates, setRates] = useState<CommissionRate[]>([])
  const [streams, setStreams] = useState<IncomeStream[]>([])
  const [loadingRates, setLoadingRates] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [streamId, setStreamId] = useState('')
  const [sourceWorkspaceId, setSourceWorkspaceId] = useState('')
  const [brand, setBrand] = useState('')
  const [commissionType, setCommissionType] = useState<CommissionType>('percentage')
  const [rate, setRate] = useState('0')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))
  const [effectiveTo, setEffectiveTo] = useState('')
  const [notes, setNotes] = useState('')

  // Earnings state
  const [earnings, setEarnings] = useState<CommissionEarning[]>([])
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null)
  const [loadingEarnings, setLoadingEarnings] = useState(false)

  const resetForm = () => {
    setStreamId(''); setSourceWorkspaceId(''); setBrand(''); setCommissionType('percentage')
    setRate('0'); setEffectiveFrom(new Date().toISOString().slice(0, 10)); setEffectiveTo(''); setNotes(''); setEditingId(null)
  }

  // Load rates + streams
  const loadRates = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        apiFetch<{ rates: CommissionRate[] }>(`/api/holding/commission/rates?workspace_id=${workspaceId}`),
        apiFetch<{ streams: IncomeStream[] }>(`/api/holding/streams?workspace_id=${workspaceId}`),
      ])
      setRates(rRes.rates)
      setStreams(sRes.streams)
    } catch { /* silent */ } finally { setLoadingRates(false) }
  }, [workspaceId])

  const loadEarnings = useCallback(async () => {
    setLoadingEarnings(true)
    try {
      const res = await apiFetch<{ earnings: CommissionEarning[]; summary: EarningsSummary }>(
        `/api/holding/commission/earnings?workspace_id=${workspaceId}`
      )
      setEarnings(res.earnings)
      setEarningsSummary(res.summary)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load earnings')
    } finally { setLoadingEarnings(false) }
  }, [workspaceId])

  useEffect(() => { loadRates() }, [loadRates])
  useEffect(() => { if (tab === 'earnings') loadEarnings() }, [tab, loadEarnings])

  const openEdit = (r: CommissionRate) => {
    setStreamId(r.stream_id); setSourceWorkspaceId(r.source_workspace_id); setBrand(r.brand)
    setCommissionType(r.commission_type); setRate(r.rate.toString()); setEffectiveFrom(r.effective_from)
    setEffectiveTo(r.effective_to || ''); setNotes(r.notes || ''); setEditingId(r.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, stream_id: streamId, source_workspace_id: sourceWorkspaceId,
        brand, commission_type: commissionType, rate: parseFloat(rate) || 0,
        effective_from: effectiveFrom, effective_to: effectiveTo || null, notes: notes || null,
      }
      if (editingId) {
        const { rate: updated } = await apiFetch<{ rate: CommissionRate }>(`/api/holding/commission/rates/${editingId}?workspace_id=${workspaceId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setRates((prev) => prev.map((r) => r.id === editingId ? updated : r))
      } else {
        const { rate: created } = await apiFetch<{ rate: CommissionRate }>('/api/holding/commission/rates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setRates((prev) => [created, ...prev])
      }
      resetForm(); setShowForm(false)
      toast.success(editingId ? 'Rate updated' : 'Rate created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, editingId, streamId, sourceWorkspaceId, brand, commissionType, rate, effectiveFrom, effectiveTo, notes])

  const handleDeleteRate = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/holding/commission/rates/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setRates((prev) => prev.filter((r) => r.id !== id))
      toast.success('Rate deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const commissionStreams = streams.filter((s) => s.type === 'commission')

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
        <h1 className="mt-1 text-2xl font-semibold">Commission</h1>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/50 p-1 w-fit">
        {(['rates', 'earnings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'rates' ? 'Rates' : 'Earnings'}
          </button>
        ))}
      </div>

      {/* === Rates Tab === */}
      {tab === 'rates' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Rate</button>
          </div>

          {showForm && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Rate' : 'New Commission Rate'}</h2>
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Stream *</label>
                    <select required value={streamId} onChange={(e) => setStreamId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                      <option value="">Select stream</option>
                      {commissionStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Source Workspace ID *</label>
                    <input required value={sourceWorkspaceId} onChange={(e) => setSourceWorkspaceId(e.target.value)} placeholder="Workspace UUID" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Brand *</label>
                    <input required value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Type</label>
                    <select value={commissionType} onChange={(e) => setCommissionType(e.target.value as CommissionType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                      <option value="percentage">Percentage</option>
                      <option value="fixed_per_unit">Fixed per unit</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Rate {commissionType === 'percentage' ? '(%)' : '(£/unit)'}</label>
                    <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">From</label>
                      <input type="date" required value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">To</label>
                      <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50">{editingId ? 'Update' : 'Create'}</button>
                  <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {loadingRates ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Stream</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Rate</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No commission rates configured</td></tr>
                  ) : rates.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium">{r.brand}</td>
                      <td className="px-4 py-3 text-slate-400">{r.stream_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.commission_type === 'percentage' ? 'Percentage' : 'Fixed/unit'}</td>
                      <td className="px-4 py-3 font-medium">{r.commission_type === 'percentage' ? `${r.rate}%` : `£${r.rate}`}</td>
                      <td className="px-4 py-3 text-slate-400">{r.effective_from}</td>
                      <td className="px-4 py-3 text-slate-400">{r.effective_to || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(r)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                          <button onClick={() => handleDeleteRate(r.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === Earnings Tab === */}
      {tab === 'earnings' && (
        <div className="space-y-6">
          {loadingEarnings ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />)}
            </div>
          ) : (
            <>
              {/* Summary */}
              {earningsSummary && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Earned</p>
                    <p className="mt-3 text-2xl font-semibold text-emerald-400">{fmtCurrency(earningsSummary.total_earned)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">By Brand</p>
                    <div className="mt-3 space-y-1">
                      {earningsSummary.by_brand.map((b) => (
                        <div key={b.brand} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{b.brand}</span>
                          <span className="font-medium">{fmtCurrency(b.earned)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">By Month</p>
                    <div className="mt-3 space-y-1">
                      {earningsSummary.by_month.slice(-6).map((m) => (
                        <div key={m.month} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300">{m.month}</span>
                          <span className="font-medium">{fmtCurrency(m.earned)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Earnings Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Units</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3">Rate</th>
                      <th className="px-4 py-3">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No commission earnings found. Make sure you have rates configured and linked workspaces with sell-in data.</td></tr>
                    ) : earnings.map((e, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-slate-400">{e.date}</td>
                        <td className="px-4 py-3 font-medium">{e.brand}</td>
                        <td className="px-4 py-3 text-slate-400">{e.customer}</td>
                        <td className="px-4 py-3 text-slate-400">{e.qty_cans.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-400">{fmtCurrency(e.revenue)}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {e.commission_type === 'percentage' ? `${e.rate}%` : `£${e.rate}/unit`}
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-400">{fmtCurrency(e.earned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
