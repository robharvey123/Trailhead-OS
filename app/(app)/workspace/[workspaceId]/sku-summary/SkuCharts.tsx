'use client'

import { useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  Formatter,
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent'
import { formatNumber, formatPercent } from '@/lib/format'

type SkuChartDatum = {
  sku: string
  totalShipped: number
  sellOut: number
  sellThrough: number
}

const seriesOptions = [
  { value: 'all', label: 'All' },
  { value: 'totalShipped', label: 'Total Shipped' },
  { value: 'sellOut', label: 'Sell Out' },
  { value: 'sellThrough', label: 'Sell Through %' },
] as const

type SeriesFilter = (typeof seriesOptions)[number]['value']

const tooltipFormatter: Formatter<ValueType, NameType> = (value, name) => {
  if (value == null) {
    return ''
  }
  if (name === 'Sell Through %') {
    return formatPercent(Number(value))
  }

  return formatNumber(Number(value))
}

export default function SkuCharts({ data }: { data: SkuChartDatum[] }) {
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>('all')
  const showTotalShipped = seriesFilter === 'all' || seriesFilter === 'totalShipped'
  const showSellOut = seriesFilter === 'all' || seriesFilter === 'sellOut'
  const showSellThrough =
    seriesFilter === 'all' || seriesFilter === 'sellThrough'
  const showLeftAxis = showTotalShipped || showSellOut
  const showRightAxis = showSellThrough

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-sm font-semibold text-slate-200">
        Top SKUs: shipped vs sell through
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {seriesOptions.map((option) => {
          const isActive = seriesFilter === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSeriesFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
                isActive
                  ? 'border-slate-200 bg-slate-200 text-slate-900'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <div className="mt-4 h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={220}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="sku" stroke="#94a3b8" fontSize={12} />
            {showLeftAxis ? (
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
            ) : null}
            {showRightAxis ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                fontSize={12}
                tickFormatter={(value) => `${value}%`}
              />
            ) : null}
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1f2937',
                color: '#e2e8f0',
              }}
              formatter={tooltipFormatter}
            />
            <Legend />
            {showTotalShipped ? (
              <Bar
                yAxisId="left"
                dataKey="totalShipped"
                name="Total Shipped"
                fill="#38bdf8"
                radius={[6, 6, 0, 0]}
              />
            ) : null}
            {showSellOut ? (
              <Bar
                yAxisId="left"
                dataKey="sellOut"
                name="Sell Out"
                fill="#f97316"
                radius={[6, 6, 0, 0]}
              />
            ) : null}
            {showSellThrough ? (
              <Line
                yAxisId="right"
                dataKey="sellThrough"
                name="Sell Through %"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
