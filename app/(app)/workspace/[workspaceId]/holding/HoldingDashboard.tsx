'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-fetch'
import type { DashboardSummary, StreamRevenue, MonthlyFlow, IncomeStreamType } from '@/lib/holding/types'
import { STREAM_TYPE_LABELS, STREAM_TYPE_BG_COLORS } from '@/lib/holding/types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const STREAM_CHART_COLORS: Record<IncomeStreamType, string> = {
  saas: '#a78bfa',
  commission: '#34d399',
  consulting: '#60a5fa',
  product: '#fbbf24',
  other: '#94a3b8',
}

const fmtCurrency = (v: number) =>
  `£${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtMonth = (v: string) => {
  const [y, m] = v.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

export default function HoldingDashboard({ workspaceId }: { workspaceId: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ summary: DashboardSummary }>(
        `/api/holding/dashboard?workspace_id=${workspaceId}`
      )
      setSummary(res.summary)
    } catch {
      // silent — cards show £0
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
      </div>
    )
  }

  const s = summary ?? {
    total_revenue: 0, total_expenses: 0, net_profit: 0, bank_balance: null,
    outstanding_invoices: 0, unreconciled_count: 0, by_stream: [], monthly: [],
  }

  const kpis = [
    { label: 'Total Revenue', value: fmtCurrency(s.total_revenue), color: 'text-emerald-400' },
    { label: 'Total Expenses', value: fmtCurrency(s.total_expenses), color: 'text-rose-400' },
    { label: 'Net Profit', value: fmtCurrency(s.net_profit), color: s.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Bank Balance', value: s.bank_balance !== null ? fmtCurrency(s.bank_balance) : '—', color: 'text-white' },
    { label: 'Outstanding Invoices', value: fmtCurrency(s.outstanding_invoices), color: 'text-amber-400' },
    { label: 'Unreconciled', value: s.unreconciled_count.toString(), color: s.unreconciled_count > 0 ? 'text-amber-400' : 'text-slate-400' },
  ]

  const pieData = s.by_stream.map((rs: StreamRevenue) => ({
    name: rs.stream_name,
    value: rs.revenue,
    color: STREAM_CHART_COLORS[rs.stream_type as IncomeStreamType] ?? '#94a3b8',
  }))

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
        <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">Consolidated view across all income streams</p>
      </header>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{k.label}</p>
            <p className={`mt-3 text-2xl font-semibold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </section>

      {/* Charts Row */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Money In/Out */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Monthly Cash Flow</h2>
          <p className="mt-1 text-sm text-slate-400">Money in vs out by month</p>
          <div className="mt-4 h-72">
            {s.monthly.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.monthly.map((m: MonthlyFlow) => ({ ...m, month: fmtMonth(m.month) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value) => fmtCurrency(Number(value))}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
                  <Bar dataKey="money_in" name="Money In" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="money_out" name="Money Out" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Revenue by Stream */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Revenue by Stream</h2>
          <p className="mt-1 text-sm text-slate-400">Breakdown of income by source</p>
          <div className="mt-4 h-72">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem' }}
                    formatter={(value) => fmtCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Stream Cards */}
      {s.by_stream.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Income Streams</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.by_stream.map((st: StreamRevenue) => (
              <Link
                key={st.stream_id}
                href={`/workspace/${workspaceId}/holding/streams`}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{st.stream_name}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STREAM_TYPE_BG_COLORS[st.stream_type as IncomeStreamType] ?? 'bg-slate-400/10 text-slate-400'}`}>
                    {STREAM_TYPE_LABELS[st.stream_type as IncomeStreamType] ?? st.stream_type}
                  </span>
                </div>
                <p className="mt-3 text-xl font-semibold text-emerald-400">{fmtCurrency(st.revenue)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: `/workspace/${workspaceId}/holding/streams`, label: 'Manage Streams', desc: 'Add & configure income streams' },
          { href: `/workspace/${workspaceId}/holding/commission`, label: 'Commission', desc: 'Rates & earned commission' },
          { href: `/workspace/${workspaceId}/holding/payments`, label: 'Stripe Payments', desc: 'SaaS subscription revenue' },
          { href: `/workspace/${workspaceId}/holding/bank`, label: 'Bank Account', desc: 'Import & reconcile transactions' },
          { href: `/workspace/${workspaceId}/holding/invoicing`, label: 'Invoicing', desc: 'Track invoices by stream' },
          { href: `/workspace/${workspaceId}/holding/expenses`, label: 'Expenses', desc: 'Log & categorise spending' },
          { href: `/workspace/${workspaceId}/holding/settings`, label: 'Settings', desc: 'Linked workspaces & config' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700 hover:bg-slate-900"
          >
            <h3 className="font-medium text-white">{link.label}</h3>
            <p className="mt-1 text-xs text-slate-400">{link.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
