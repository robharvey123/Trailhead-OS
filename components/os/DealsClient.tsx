'use client'

import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import {
  type DealForecastBucket,
  type DealInput,
  type DealStage,
  type DealWithRelations,
} from '@/lib/types'
import DealKanban from './DealKanban'
import DealForm from './DealForm'
import StageBadge from './StageBadge'

interface DealsClientProps {
  initialDeals: DealWithRelations[]
  accounts: Array<{ id: string; name: string }>
}

type View = 'kanban' | 'table'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DealsClient({ initialDeals, accounts }: DealsClientProps) {
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals)
  const [view, setView] = useState<View>('kanban')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DealWithRelations | null>(null)
  const [showForecast, setShowForecast] = useState(false)
  const [error, setError] = useState('')

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const openTotal = useMemo(
    () =>
      deals
        .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
        .reduce((sum, d) => sum + (d.value_amount ?? 0), 0),
    [deals]
  )
  const weightedTotal = useMemo(
    () =>
      deals
        .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
        .reduce((sum, d) => sum + (d.value_amount ?? 0) * (d.probability / 100), 0),
    [deals]
  )

  async function handleMove(dealId: string, stage: DealStage) {
    const target = deals.find((d) => d.id === dealId)
    if (!target || target.stage === stage) return
    const previous = deals
    setError('')
    setDeals((current) => current.map((d) => (d.id === dealId ? { ...d, stage } : d)))
    try {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      setDeals((current) =>
        current.map((d) => (d.id === dealId ? { ...d, ...deal, account: d.account } : d))
      )
    } catch (err) {
      setDeals(previous)
      setError(err instanceof Error ? err.message : 'Failed to move deal')
    }
  }

  async function handleSave(input: DealInput) {
    if (input.id) {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>(`/api/deals/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((current) =>
        current.map((d) =>
          d.id === input.id
            ? { ...d, ...deal, account: { id: deal.account_id, name: accountName.get(deal.account_id) ?? '' } }
            : d
        )
      )
    } else {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((current) => [
        { ...deal, account: { id: deal.account_id, name: accountName.get(deal.account_id) ?? '' } },
        ...current,
      ])
    }
  }

  async function handleDelete(id: string) {
    const previous = deals
    setDeals((current) => current.filter((d) => d.id !== id))
    setFormOpen(false)
    setEditing(null)
    try {
      await apiFetch(`/api/deals/${id}`, { method: 'DELETE' })
    } catch (err) {
      setDeals(previous)
      setError(err instanceof Error ? err.message : 'Failed to delete deal')
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(deal: DealWithRelations) {
    setEditing(deal)
    setFormOpen(true)
  }

  const forecast = useMemo<DealForecastBucket[]>(() => {
    const buckets = new Map<string, DealForecastBucket>()
    for (const d of deals) {
      if (d.stage === 'Won' || d.stage === 'Lost' || !d.expected_close_date) continue
      const month = d.expected_close_date.slice(0, 7)
      const bucket = buckets.get(month) ?? {
        month,
        deal_count: 0,
        total_value: 0,
        weighted_value: 0,
      }
      const value = d.value_amount ?? 0
      bucket.deal_count += 1
      bucket.total_value += value
      bucket.weighted_value += value * (d.probability / 100)
      buckets.set(month, bucket)
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 6)
  }, [deals])

  const toggleBtn = (target: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(target)}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        view === target ? 'bg-white text-[#0C0C14]' : 'text-[#9CA3AF] hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Deals</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Open pipeline {formatCurrency(openTotal, 'GBP')} · weighted{' '}
            {formatCurrency(weightedTotal, 'GBP')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[#2A2A3A] bg-[#1A1A28] p-1">
            {toggleBtn('kanban', 'Kanban')}
            {toggleBtn('table', 'Table')}
          </div>
          <button
            type="button"
            onClick={() => setShowForecast(true)}
            className="rounded-xl border border-[#2A2A3A] bg-[#1A1A28] px-4 py-2 text-sm text-[#9CA3AF] hover:text-white"
          >
            Forecast
          </button>
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0C0C14] hover:bg-[#E5E7EB]"
          >
            + New deal
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {view === 'kanban' ? (
        <DealKanban deals={deals} onMove={handleMove} onSelect={openEdit} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#2A2A3A] bg-[#1A1A28]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#2A2A3A] text-xs uppercase tracking-wide text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Prob.</th>
                <th className="px-4 py-3 text-right">Weighted</th>
                <th className="px-4 py-3">Close</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#6B7280]">
                    No deals yet. Create your first deal.
                  </td>
                </tr>
              ) : (
                deals.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => openEdit(d)}
                    className="cursor-pointer border-b border-[#23232F] last:border-0 hover:bg-[#16161F]"
                  >
                    <td className="px-4 py-3 font-medium text-white">{d.name}</td>
                    <td className="px-4 py-3 text-[#9CA3AF]">{d.account?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={d.stage} />
                    </td>
                    <td className="px-4 py-3 text-right text-white">
                      {d.value_amount != null ? formatCurrency(d.value_amount, d.value_currency || 'GBP') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[#9CA3AF]">{d.probability}%</td>
                    <td className="px-4 py-3 text-right text-[#9CA3AF]">
                      {d.value_amount != null
                        ? formatCurrency(d.value_amount * (d.probability / 100), d.value_currency || 'GBP')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#9CA3AF]">{formatDate(d.expected_close_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <DealForm
          deal={editing}
          accounts={accounts}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
        />
      ) : null}

      {showForecast ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowForecast(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Weighted forecast — next 6 months</h2>
              <button onClick={() => setShowForecast(false)} className="text-[#9CA3AF] hover:text-white">
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-[#6B7280]">
              value × probability, bucketed by expected close. Excludes Won/Lost.
            </p>
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-[#2A2A3A] text-xs uppercase tracking-wide text-[#9CA3AF]">
                <tr>
                  <th className="py-2">Month</th>
                  <th className="py-2 text-right">Deals</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {forecast.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#6B7280]">
                      No deals with an expected close date.
                    </td>
                  </tr>
                ) : (
                  forecast.map((b) => (
                    <tr key={b.month} className="border-b border-[#23232F] last:border-0">
                      <td className="py-2 text-white">{b.month}</td>
                      <td className="py-2 text-right text-[#9CA3AF]">{b.deal_count}</td>
                      <td className="py-2 text-right text-[#9CA3AF]">
                        {formatCurrency(b.total_value, 'GBP')}
                      </td>
                      <td className="py-2 text-right font-medium text-white">
                        {formatCurrency(b.weighted_value, 'GBP')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
