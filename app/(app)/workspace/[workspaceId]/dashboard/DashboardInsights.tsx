'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent'
import {
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  formatPercent,
} from '@/lib/format'

type MonthDatum = {
  month: string
  value: number
}

type CategoryDatum = {
  label: string
  value: number
}

type DashboardInsightsProps = {
  aspData: MonthDatum[]
  promoRateData: MonthDatum[]
  platformData: CategoryDatum[]
  regionData: CategoryDatum[]
  topCustomerRevenue: CategoryDatum[]
  topCompanySellOut: CategoryDatum[]
  currencySymbol: string
}

/* Chart colours are working tokens passed as strings, so the same chart reads
   on white and on navy. Utilities only in this file (no .thmock component
   classes): it also renders on the public report page. */
const SERIES = [
  'var(--accent)',
  'var(--amber)',
  'var(--emerald)',
  'var(--accent-strong)',
] as const
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
const BAR_CURSOR = { fill: 'var(--surface-2)' }
const LINE_CURSOR = { stroke: 'var(--border-light)' }

const chartCardClass =
  'rounded-card border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-sm)]'

// Legend labels in body ink: a series colour is a fill, not a type colour.
const legendLabel = (value: string) => (
  <span className="text-[var(--text-2)]">{value}</span>
)

const formatNumberValue = (value?: ValueType) =>
  value == null ? '' : formatNumber(Number(value))

const formatPercentValue = (value?: ValueType) =>
  value == null ? '' : formatPercent(Number(value))

const formatCurrencyValue = (value: ValueType | undefined, symbol: string) =>
  value == null ? '' : formatCurrency(Number(value), symbol)

export default function DashboardInsights({
  aspData,
  promoRateData,
  platformData,
  regionData,
  topCustomerRevenue,
  topCompanySellOut,
  currencySymbol,
}: DashboardInsightsProps) {
  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Average selling price (ASP)
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <LineChart data={aspData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  dataKey="month"
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => formatMonthLabel(String(value))}
                />
                <YAxis
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => formatCurrency(Number(value), currencySymbol)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={LINE_CURSOR}
                  formatter={(value) =>
                    formatCurrencyValue(value, currencySymbol)
                  }
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="ASP"
                  stroke={SERIES[3]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">Promo rate</h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <LineChart data={promoRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  dataKey="month"
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => formatMonthLabel(String(value))}
                />
                <YAxis
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={LINE_CURSOR}
                  formatter={(value) => formatPercentValue(value)}
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Promo rate"
                  stroke={SERIES[1]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Sell-out by platform
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <BarChart data={platformData} barGap={6} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" stroke={AXIS} tick={TICK} fontSize={12} />
                <YAxis stroke={AXIS} tick={TICK} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={BAR_CURSOR}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend formatter={legendLabel} />
                <Bar dataKey="value" name="Sell Out" fill={SERIES[2]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Sell-out by region
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <BarChart data={regionData} barGap={6} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" stroke={AXIS} tick={TICK} fontSize={12} />
                <YAxis stroke={AXIS} tick={TICK} fontSize={12} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={BAR_CURSOR}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend formatter={legendLabel} />
                <Bar dataKey="value" name="Sell Out" fill={SERIES[3]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Top customers by revenue
          </h3>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topCustomerRevenue} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => formatCurrency(Number(value), currencySymbol)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={BAR_CURSOR}
                  formatter={(value) =>
                    formatCurrencyValue(value, currencySymbol)
                  }
                />
                <Legend formatter={legendLabel} />
                <Bar dataKey="value" name="Revenue" fill={SERIES[0]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Top companies by sell-out
          </h3>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topCompanySellOut} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis
                  type="number"
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  stroke={AXIS}
                  tick={TICK}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  cursor={BAR_CURSOR}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend formatter={legendLabel} />
                <Bar dataKey="value" name="Sell Out" fill={SERIES[1]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
