'use client'

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
import type {
  Formatter,
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent'
import { formatMonthLabel, formatNumber } from '@/lib/format'

type CompanyMonthlyChartDatum = {
  month: string
  sellIn: number
  sellOut: number
}

const tooltipFormatter: Formatter<ValueType, NameType> = (value) =>
  value == null ? '' : formatNumber(Number(value))

export default function CompanyMonthlyCharts({
  data,
  title = 'Monthly sell in vs sell out',
}: {
  data: CompanyMonthlyChartDatum[]
  title?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <div className="mt-4 h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
          <BarChart data={data} barGap={8} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              fontSize={12}
              tickFormatter={(value) => formatMonthLabel(String(value))}
            />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1f2937',
                color: '#e2e8f0',
              }}
              formatter={tooltipFormatter}
              labelFormatter={(value) => formatMonthLabel(String(value))}
            />
            <Legend />
            <Bar
              dataKey="sellIn"
              name="Sell in"
              fill="#38bdf8"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="sellOut"
              name="Sell out"
              fill="#f97316"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
