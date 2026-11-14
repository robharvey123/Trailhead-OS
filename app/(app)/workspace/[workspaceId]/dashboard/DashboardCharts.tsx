'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { formatMonthLabel, formatNumber } from '@/lib/format'

type DashboardChartDatum = {
  month: string
  totalShipped: number
  sellOut: number
  cumulativeStock: number
}

/* Chart colours are working tokens passed as strings, so the same chart reads
   on white and on navy. Utilities only in this file (no .thmock component
   classes): it also renders on the public report page. */
const SERIES = ['var(--accent)', 'var(--amber)', 'var(--emerald)'] as const
const GRID = 'var(--border)'
const AXIS = 'var(--border-light)'
const TICK = { fill: 'var(--text-3)', fontSize: 12 }
const TOOLTIP_STYLE = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  color: 'var(--text)',
}
const TOOLTIP_ITEM_STYLE = { color: 'var(--text)' }
const CARD =
  'rounded-card border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-sm)]'

const tooltipFormatter: Formatter<ValueType, NameType> = (value) =>
  value == null ? '' : formatNumber(Number(value))

// Legend labels in body ink: a series colour is a fill, not a type colour.
const legendLabel = (value: string) => (
  <span className="text-[var(--text-2)]">{value}</span>
)

export default function DashboardCharts({
  data,
}: {
  data: DashboardChartDatum[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={CARD}>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Monthly shipped vs sell out
        </h3>
        <div className="mt-4 h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
            <BarChart data={data} barGap={8} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey="month"
                stroke={AXIS}
                tick={TICK}
                fontSize={12}
                tickFormatter={(value) => formatMonthLabel(String(value))}
              />
              <YAxis stroke={AXIS} tick={TICK} fontSize={12} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ fill: 'var(--surface-2)' }}
                formatter={tooltipFormatter}
                labelFormatter={(value) => formatMonthLabel(String(value))}
              />
              <Legend formatter={legendLabel} />
              <Bar
                dataKey="totalShipped"
                name="Total shipped"
                fill={SERIES[0]}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="sellOut"
                name="Sell out"
                fill={SERIES[1]}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Cumulative channel stock build
        </h3>
        <div className="mt-4 h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey="month"
                stroke={AXIS}
                tick={TICK}
                fontSize={12}
                tickFormatter={(value) => formatMonthLabel(String(value))}
              />
              <YAxis stroke={AXIS} tick={TICK} fontSize={12} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ stroke: 'var(--border-light)' }}
                formatter={tooltipFormatter}
                labelFormatter={(value) => formatMonthLabel(String(value))}
              />
              <Area
                type="monotone"
                dataKey="cumulativeStock"
                name="Cumulative stock"
                stroke={SERIES[2]}
                fill={SERIES[2]}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
