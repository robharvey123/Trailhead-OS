'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'

type FxRate = {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  effective_date: string
}

export default function FxRatesTable({
  workspaceId,
  baseCurrency,
  supportedCurrencies,
  initialRates,
}: {
  workspaceId: string
  baseCurrency: string
  supportedCurrencies: string[]
  initialRates: FxRate[]
}) {
  const [rates, setRates] = useState(initialRates)
  const [fromCurrency, setFromCurrency] = useState('')
  const [rate, setRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [saving, setSaving] = useState(false)

  const otherCurrencies = supportedCurrencies.filter((c) => c !== baseCurrency)

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!fromCurrency || !rate) return
      setSaving(true)
      try {
        const { rate: created } = await apiFetch<{ rate: FxRate }>(
          '/api/analytics/fx-rates',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              from_currency: fromCurrency,
              to_currency: baseCurrency,
              rate: parseFloat(rate),
              effective_date: effectiveDate,
            }),
          }
        )
        setRates((prev) => [created, ...prev])
        setFromCurrency('')
        setRate('')
        toast.success('FX rate added')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to add rate'
        )
      } finally {
        setSaving(false)
      }
    },
    [workspaceId, baseCurrency, fromCurrency, rate, effectiveDate]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiFetch(
          `/api/analytics/fx-rates/${id}?workspace_id=${workspaceId}`,
          { method: 'DELETE' }
        )
        setRates((prev) => prev.filter((r) => r.id !== id))
        toast.success('Rate deleted')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to delete rate'
        )
      }
    },
    [workspaceId]
  )

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-end gap-3"
      >
        <div>
          <label className="mb-1 block text-xs text-slate-400">From</label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            {otherCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-slate-400 pb-2">→ {baseCurrency}</div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Rate</label>
          <input
            type="number"
            step="0.00000001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            placeholder="0.85"
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Effective date
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-70"
        >
          Add
        </button>
      </form>

      {rates.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-800/50 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2">{r.from_currency}</td>
                  <td className="px-4 py-2">{r.to_currency}</td>
                  <td className="px-4 py-2 font-mono">{r.rate}</td>
                  <td className="px-4 py-2 text-slate-400">
                    {r.effective_date}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rates.length === 0 && (
        <p className="text-sm text-slate-500">
          No FX rates configured. Add rates to enable multi-currency reporting.
        </p>
      )}
    </div>
  )
}
