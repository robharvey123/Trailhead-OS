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
import type { Formatter, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { formatNumber } from '@/lib/format'

type CompanySkuChartDatum = {
  sku: string
  sellIn: number
  sellOut: number
}

const tooltipFormatter: Formatter<number | undefined, NameType> = (value) =>
  value == null ? '' : formatNumber(Number(value))

export default function CompanySkuCharts({
  data,
}: {
  data: CompanySkuChartDatum[]
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        SKU sold by company
      </h4>
      <div className="mt-4 h-64 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={200}>
          <BarChart data={data} barGap={6} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="sku"
              stroke="#94a3b8"
              fontSize={12}
              interval="preserveStartEnd"
            />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1f2937',
                color: '#e2e8f0',
              }}
              formatter={tooltipFormatter}
            />
            <Legend />
            <Bar dataKey="sellIn" name="Sell In" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="sellOut" name="Sell Out" fill="#f97316" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
