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
  // Colour here means something: only the two cards with a live threshold
  // (low stock, unread) carry an accent bar. A different colour per card with
  // no legend is decoration pretending to be information.
  const cards = [
    { label: 'Pipeline Value', value: fmtCurrency(kpis.pipelineValue, kpis.currencySymbol), sub: `${kpis.activeDealCount} active deals`, href: `${base}/deals`, color: '' },
    { label: 'Outstanding Invoices', value: fmtCurrency(kpis.outstandingTotal, kpis.currencySymbol), sub: `${kpis.outstandingInvoices} invoices`, href: `${base}/invoices`, color: '' },
    { label: 'Active Campaigns', value: kpis.activeCampaignCount.toString(), sub: 'active or scheduled', href: `${base}/campaigns`, color: '' },
    { label: 'Low Stock Items', value: kpis.lowStockCount.toString(), sub: 'below reorder point', href: `${base}/inventory`, color: kpis.lowStockCount > 0 ? 'border-l-[var(--red)]' : 'border-l-[var(--emerald)]' },
    { label: 'In-Transit Shipments', value: kpis.inTransitShipments.toString(), sub: 'currently shipping', href: `${base}/shipments`, color: '' },
    { label: 'Active Staff', value: kpis.activeStaffCount.toString(), sub: 'team members', href: `${base}/staff`, color: '' },
    { label: 'Unread Notifications', value: kpis.unreadNotifications.toString(), sub: 'pending', href: `${base}/notifications`, color: kpis.unreadNotifications > 0 ? 'border-l-[var(--red)]' : 'border-l-[var(--border)]' },
  ]

  return (
    <section>
      <h2 className="os-label mb-3">Module Overview</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`block rounded-card border border-[var(--border)] bg-[var(--bg)] p-4 text-[var(--text)] no-underline shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface)] ${c.color ? `border-l-4 ${c.color}` : ''}`}>
            <p className="os-label">{c.label}</p>
            <p className="stat-value mt-1">{c.value}</p>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">{c.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
