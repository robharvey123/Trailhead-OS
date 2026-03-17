'use client'

import Link from 'next/link'

type ModuleKPIs = {
  outstandingInvoices: number
  outstandingTotal: number
  activeDealCount: number
  pipelineValue: number
  activeCampaignCount: number
  lowStockCount: number
  inTransitShipments: number
  activeStaffCount: number
  unreadNotifications: number
  currencySymbol: string
}

const fmtCurrency = (v: number, sym: string) => `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

export default function DashboardKPIs({ kpis, workspaceId }: { kpis: ModuleKPIs; workspaceId: string }) {
  const base = `/workspace/${workspaceId}`
  const cards = [
    { label: 'Pipeline Value', value: fmtCurrency(kpis.pipelineValue, kpis.currencySymbol), sub: `${kpis.activeDealCount} active deals`, href: `${base}/deals`, color: 'border-l-blue-500' },
    { label: 'Outstanding Invoices', value: fmtCurrency(kpis.outstandingTotal, kpis.currencySymbol), sub: `${kpis.outstandingInvoices} invoices`, href: `${base}/invoices`, color: 'border-l-amber-500' },
    { label: 'Active Campaigns', value: kpis.activeCampaignCount.toString(), sub: 'active or scheduled', href: `${base}/campaigns`, color: 'border-l-purple-500' },
    { label: 'Low Stock Items', value: kpis.lowStockCount.toString(), sub: 'below reorder point', href: `${base}/inventory`, color: kpis.lowStockCount > 0 ? 'border-l-rose-500' : 'border-l-emerald-500' },
    { label: 'In-Transit Shipments', value: kpis.inTransitShipments.toString(), sub: 'currently shipping', href: `${base}/shipments`, color: 'border-l-indigo-500' },
    { label: 'Active Staff', value: kpis.activeStaffCount.toString(), sub: 'team members', href: `${base}/staff`, color: 'border-l-cyan-500' },
    { label: 'Unread Notifications', value: kpis.unreadNotifications.toString(), sub: 'pending', href: `${base}/notifications`, color: kpis.unreadNotifications > 0 ? 'border-l-rose-400' : 'border-l-slate-600' },
  ]

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-slate-400">Module Overview</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-xl border border-slate-800 border-l-4 ${c.color} bg-slate-900/70 p-4 transition hover:bg-slate-900`}>
            <p className="text-[11px] uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className="mt-1 text-lg font-semibold">{c.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{c.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
