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

const chartCardClass =
  'rounded-2xl border border-slate-800 bg-slate-900/70 p-6'

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
          <h3 className="text-sm font-semibold text-slate-200">
            Average selling price (ASP)
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <LineChart data={aspData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => formatMonthLabel(String(value))}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => formatCurrency(Number(value), currencySymbol)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) =>
                    formatCurrencyValue(value, currencySymbol)
                  }
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="ASP"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-slate-200">Promo rate</h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <LineChart data={promoRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => formatMonthLabel(String(value))}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) => formatPercentValue(value)}
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Promo rate"
                  stroke="#f59e0b"
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
          <h3 className="text-sm font-semibold text-slate-200">
            Sell-out by platform
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <BarChart data={platformData} barGap={6} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend />
                <Bar dataKey="value" name="Sell Out" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-slate-200">
            Sell-out by region
          </h3>
          <div className="mt-4 h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
              <BarChart data={regionData} barGap={6} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend />
                <Bar dataKey="value" name="Sell Out" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-slate-200">
            Top customers by revenue
          </h3>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topCustomerRevenue} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => formatCurrency(Number(value), currencySymbol)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) =>
                    formatCurrencyValue(value, currencySymbol)
                  }
                />
                <Legend />
                <Bar dataKey="value" name="Revenue" fill="#38bdf8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-sm font-semibold text-slate-200">
            Top companies by sell-out
          </h3>
          <div className="mt-4 h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={220}>
              <BarChart data={topCompanySellOut} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1f2937',
                    color: '#e2e8f0',
                  }}
                  formatter={(value) => formatNumberValue(value)}
                />
                <Legend />
                <Bar dataKey="value" name="Sell Out" fill="#f59e0b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
