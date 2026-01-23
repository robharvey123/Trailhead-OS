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
import { formatNumber } from '@/lib/format'

type DashboardChartDatum = {
  month: string
  totalShipped: number
  sellOut: number
  cumulativeStock: number
}

const tooltipFormatter = (value: number) => formatNumber(value)

export default function DashboardCharts({
  data,
}: {
  data: DashboardChartDatum[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-sm font-semibold text-slate-200">
          Monthly shipped vs sell out
        </h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={8} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
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
              <Bar
                dataKey="totalShipped"
                name="Total shipped"
                fill="#38bdf8"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="sellOut"
                name="Sell out"
                fill="#f59e0b"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h3 className="text-sm font-semibold text-slate-200">
          Cumulative channel stock build
        </h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #1f2937',
                  color: '#e2e8f0',
                }}
                formatter={tooltipFormatter}
              />
              <Area
                type="monotone"
                dataKey="cumulativeStock"
                name="Cumulative stock"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
