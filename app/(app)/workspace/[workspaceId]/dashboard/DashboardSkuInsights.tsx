'use client'

import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMonthLabel, formatNumber, formatPercent } from '@/lib/format'

type TopSkuDatum = {
  sku: string
  totalShipped: number
  sellOut: number
  revenue: number
  sellThrough: number
}

type MonthlyLeaderDatum = {
  month: string
  topShippedSku: string
  topShippedUnits: number
  topSellOutSku: string
  topSellOutUnits: number
}

function formatCurrency(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export default function DashboardSkuInsights({
  workspaceId,
  currencySymbol,
  topSkus,
  monthlyLeaders,
}: {
  workspaceId: string
  currencySymbol: string
  topSkus: TopSkuDatum[]
  monthlyLeaders: MonthlyLeaderDatum[]
}) {
  const bestShipped = topSkus[0] ?? null
  const bestSellOut = [...topSkus].sort((left, right) => right.sellOut - left.sellOut)[0] ?? null
  const bestSellThrough = [...topSkus].sort((left, right) => right.sellThrough - left.sellThrough)[0] ?? null

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Best-selling SKUs</h2>
          <p className="mt-2 text-sm text-slate-300">
            All-time winners plus the monthly leaders across shipped units and sell-out.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/workspace/${workspaceId}/sku-summary`}
            className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-slate-500"
          >
            Open SKU summary
          </Link>
          <Link
            href={`/workspace/${workspaceId}/company-sku-detail`}
            className="rounded-full border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-slate-500"
          >
            Open company SKU view
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Top shipped SKU</p>
          <p className="mt-3 text-lg font-semibold text-white">{bestShipped?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-300">
            {bestShipped ? `${formatNumber(bestShipped.totalShipped)} shipped` : 'No SKU data yet'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Top sell-out SKU</p>
          <p className="mt-3 text-lg font-semibold text-white">{bestSellOut?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-300">
            {bestSellOut ? `${formatNumber(bestSellOut.sellOut)} sold out` : 'No SKU data yet'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Best sell-through</p>
          <p className="mt-3 text-lg font-semibold text-white">{bestSellThrough?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-slate-300">
            {bestSellThrough ? formatPercent(bestSellThrough.sellThrough) : 'No SKU data yet'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">Top 10 SKUs all time</h3>
          <div className="mt-4 h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topSkus} barGap={6} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="sku" stroke="#94a3b8" fontSize={12} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }}
                  formatter={(value, name) => {
                    if (name === 'Revenue') {
                      return formatCurrency(Number(value), currencySymbol)
                    }
                    if (name === 'Sell through %') {
                      return formatPercent(Number(value))
                    }
                    return formatNumber(Number(value))
                  }}
                />
                <Legend />
                <Bar dataKey="totalShipped" name="Total shipped" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sellOut" name="Sell out" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="text-sm font-semibold text-slate-200">Top SKU leaderboard</h3>
          <div className="mt-4 space-y-3">
            {topSkus.map((sku) => (
              <div
                key={sku.sku}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{sku.sku}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Revenue {formatCurrency(sku.revenue, currencySymbol)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>{formatNumber(sku.totalShipped)} shipped</p>
                    <p>{formatNumber(sku.sellOut)} sold out</p>
                    <p>{formatPercent(sku.sellThrough)} sell-through</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-sm font-semibold text-slate-200">Monthly SKU leaders</h3>
        <p className="mt-2 text-sm text-slate-300">
          Best performer each month for shipped units and sell-out.
        </p>

        {monthlyLeaders.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="pb-3">Month</th>
                  <th className="pb-3">Top shipped SKU</th>
                  <th className="pb-3 text-right">Units</th>
                  <th className="pb-3">Top sell-out SKU</th>
                  <th className="pb-3 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {monthlyLeaders.map((row) => (
                  <tr key={row.month} className="border-t border-slate-800">
                    <td className="py-3 text-slate-200">{formatMonthLabel(row.month)}</td>
                    <td className="py-3 text-slate-100">{row.topShippedSku || '—'}</td>
                    <td className="py-3 text-right text-slate-300">{formatNumber(row.topShippedUnits)}</td>
                    <td className="py-3 text-slate-100">{row.topSellOutSku || '—'}</td>
                    <td className="py-3 text-right text-slate-300">{formatNumber(row.topSellOutUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No SKU leaderboard data available yet.</p>
        )}
      </div>
    </section>
  )
}