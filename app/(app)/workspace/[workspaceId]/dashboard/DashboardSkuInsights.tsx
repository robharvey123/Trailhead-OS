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

// Chart colours are working tokens passed as strings.
const SERIES = ['var(--accent)', 'var(--amber)'] as const
const TICK = { fill: 'var(--text-3)', fontSize: 12 }
const TOOLTIP_STYLE = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
}

// Legend labels in body ink: a series colour is a fill, not a type colour.
const legendLabel = (value: string) => (
  <span className="text-[var(--text-2)]">{value}</span>
)

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
          <h2 className="text-lg font-semibold text-[var(--text)]">Best-selling SKUs</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            All-time winners plus the monthly leaders across shipped units and sell-out.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/workspace/${workspaceId}/sku-summary`}
            className="btn btn-ghost btn-sm"
          >
            Open SKU summary
          </Link>
          <Link
            href={`/workspace/${workspaceId}/company-sku-detail`}
            className="btn btn-ghost btn-sm"
          >
            Open company SKU view
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="os-card p-5">
          <p className="os-label">Top shipped SKU</p>
          <p className="mt-3 text-lg font-semibold text-[var(--text)]">{bestShipped?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {bestShipped ? `${formatNumber(bestShipped.totalShipped)} shipped` : 'No SKU data yet'}
          </p>
        </div>
        <div className="os-card p-5">
          <p className="os-label">Top sell-out SKU</p>
          <p className="mt-3 text-lg font-semibold text-[var(--text)]">{bestSellOut?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {bestSellOut ? `${formatNumber(bestSellOut.sellOut)} sold out` : 'No SKU data yet'}
          </p>
        </div>
        <div className="os-card p-5">
          <p className="os-label">Best sell-through</p>
          <p className="mt-3 text-lg font-semibold text-[var(--text)]">{bestSellThrough?.sku ?? '—'}</p>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {bestSellThrough ? formatPercent(bestSellThrough.sellThrough) : 'No SKU data yet'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <div className="os-card p-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">Top 10 SKUs all time</h3>
          <div className="mt-4 h-80 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topSkus} barGap={6} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="sku" stroke="var(--border-light)" tick={TICK} fontSize={12} interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis stroke="var(--border-light)" tick={TICK} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: 'var(--text)' }}
                  cursor={{ fill: 'var(--surface-2)' }}
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
                <Legend formatter={legendLabel} />
                <Bar dataKey="totalShipped" name="Total shipped" fill={SERIES[0]} radius={[6, 6, 0, 0]} />
                <Bar dataKey="sellOut" name="Sell out" fill={SERIES[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="os-card p-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">Top SKU leaderboard</h3>
          <div className="mt-4 space-y-3">
            {topSkus.map((sku) => (
              <div
                key={sku.sku}
                className="rounded-control border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--text)]">{sku.sku}</p>
                    <p className="mt-1 text-xs text-[var(--text-3)]">
                      Revenue {formatCurrency(sku.revenue, currencySymbol)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--text-3)]">
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

      <div className="os-card p-6">
        <h3 className="text-sm font-semibold text-[var(--text)]">Monthly SKU leaders</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Best performer each month for shipped units and sell-out.
        </p>

        {monthlyLeaders.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="os-label pb-3">Month</th>
                  <th className="os-label pb-3">Top shipped SKU</th>
                  <th className="os-label pb-3 text-right">Units</th>
                  <th className="os-label pb-3">Top sell-out SKU</th>
                  <th className="os-label pb-3 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {monthlyLeaders.map((row) => (
                  <tr key={row.month} className="border-t border-[var(--border)]">
                    <td className="py-3 text-[var(--text)]">{formatMonthLabel(row.month)}</td>
                    <td className="py-3 text-[var(--text)]">{row.topShippedSku || '—'}</td>
                    <td className="py-3 text-right text-[var(--text-2)]">{formatNumber(row.topShippedUnits)}</td>
                    <td className="py-3 text-[var(--text)]">{row.topSellOutSku || '—'}</td>
                    <td className="py-3 text-right text-[var(--text-2)]">{formatNumber(row.topSellOutUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-3)]">No SKU leaderboard data available yet.</p>
        )}
      </div>
    </section>
  )
}