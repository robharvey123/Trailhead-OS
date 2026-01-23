'use client'

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
import { formatNumber, formatPercent } from '@/lib/format'

type SkuChartDatum = {
  sku: string
  totalShipped: number
  sellOut: number
  sellThrough: number
}

const tooltipFormatter = (value: number, name: string) => {
  if (name === 'Sell Through %') {
    return formatPercent(value)
  }

  return formatNumber(value)
}

export default function SkuCharts({ data }: { data: SkuChartDatum[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <h3 className="text-sm font-semibold text-slate-200">
        Top SKUs: shipped vs sell through
      </h3>
      <div className="mt-4 h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={220}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="sku" stroke="#94a3b8" fontSize={12} />
            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} />
            <YAxis
              yAxisId="right"
              orientation="right"
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
              formatter={tooltipFormatter}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="totalShipped"
              name="Total Shipped"
              fill="#38bdf8"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              yAxisId="left"
              dataKey="sellOut"
              name="Sell Out"
              fill="#f97316"
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="right"
              dataKey="sellThrough"
              name="Sell Through %"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
