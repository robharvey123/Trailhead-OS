'use client'

import { useEffect, useState } from 'react'
import { getWorkstreamColourClasses } from '@/lib/os'

interface PnLRow {
  workstream_id: string
  slug: string
  label: string
  colour: string
  revenue: number
  expenses: number
  net: number
}

interface PnLTotals {
  revenue: number
  expenses: number
  net: number
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}£${Math.abs(value).toFixed(2)}`
}

export default function WorkstreamPnL() {
  const [rows, setRows] = useState<PnLRow[]>([])
  const [totals, setTotals] = useState<PnLTotals>({ revenue: 0, expenses: 0, net: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/expenses/pnl')
      .then((res) => res.json())
      .then((data) => {
        setRows(data.rows ?? [])
        setTotals(data.totals ?? { revenue: 0, expenses: 0, net: 0 })
      })
      .catch(() => {
        setRows([])
        setTotals({ revenue: 0, expenses: 0, net: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-[#2A2A3A]" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-10 animate-pulse rounded-xl bg-[#2A2A3A]/50" />
          ))}
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
      <h2 className="text-lg font-semibold text-white">Workstream P&L</h2>
      <p className="mt-1 text-sm text-[#9CA3AF]">Revenue from paid invoices vs. total expenses</p>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.2em] text-white0">
            <tr>
              <th className="pb-3">Workstream</th>
              <th className="pb-3 text-right">Revenue</th>
              <th className="pb-3 text-right">Expenses</th>
              <th className="pb-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const classes = getWorkstreamColourClasses(row.colour ?? row.slug)
              return (
                <tr key={row.workstream_id || 'unassigned'} className="border-t border-[#2A2A3A]">
                  <td className="py-3">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${classes.dot}`} />
                      <span className="text-white">{row.label}</span>
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium text-emerald-300">
                    {formatMoney(row.revenue)}
                  </td>
                  <td className="py-3 text-right font-medium text-rose-300">
                    {formatMoney(row.expenses)}
                  </td>
                  <td
                    className={`py-3 text-right font-semibold ${
                      row.net >= 0 ? 'text-emerald-200' : 'text-rose-200'
                    }`}
                  >
                    {formatMoney(row.net)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#2A2A3A]">
              <td className="py-3 font-semibold text-white">Total</td>
              <td className="py-3 text-right font-semibold text-emerald-200">
                {formatMoney(totals.revenue)}
              </td>
              <td className="py-3 text-right font-semibold text-rose-200">
                {formatMoney(totals.expenses)}
              </td>
              <td
                className={`py-3 text-right text-base font-bold ${
                  totals.net >= 0 ? 'text-emerald-100' : 'text-rose-100'
                }`}
              >
                {formatMoney(totals.net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
