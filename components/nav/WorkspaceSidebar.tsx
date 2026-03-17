'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export type NavSection = {
  label: string
  items: { slug: string; label: string }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { slug: 'dashboard', label: 'Dashboard' },
      { slug: 'insights', label: 'Insights' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { slug: 'sell-in', label: 'Sell In' },
      { slug: 'sell-out', label: 'Sell Out' },
      { slug: 'comparison', label: 'Compare' },
      { slug: 'promo', label: 'Promo' },
      { slug: 'pnl', label: 'P&L' },
      { slug: 'sku-summary', label: 'SKU Summary' },
      { slug: 'company-summary', label: 'Company Summary' },
      { slug: 'company-sku-detail', label: 'Company SKU' },
    ],
  },
  {
    label: 'CRM',
    items: [
      { slug: 'accounts', label: 'Accounts' },
      { slug: 'contacts', label: 'Contacts' },
      { slug: 'deals', label: 'Deals' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { slug: 'campaigns', label: 'Campaigns' },
      { slug: 'content', label: 'Content' },
      { slug: 'assets', label: 'Assets' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { slug: 'invoices', label: 'Invoices' },
      { slug: 'purchase-orders', label: 'Purchase Orders' },
      { slug: 'budgets', label: 'Budgets' },
    ],
  },
  {
    label: 'Products',
    items: [
      { slug: 'catalog', label: 'Catalog' },
      { slug: 'launches', label: 'Launches' },
    ],
  },
  {
    label: 'Supply Chain',
    items: [
      { slug: 'inventory', label: 'Inventory' },
      { slug: 'supply-orders', label: 'Supply Orders' },
      { slug: 'shipments', label: 'Shipments' },
    ],
  },
  {
    label: 'Team',
    items: [
      { slug: 'staff', label: 'Staff' },
      { slug: 'schedule', label: 'Schedule' },
      { slug: 'time-tracking', label: 'Time Tracking' },
    ],
  },
  {
    label: 'Comms',
    items: [
      { slug: 'messages', label: 'Messages' },
      { slug: 'notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { slug: 'tasks', label: 'Tasks' },
      { slug: 'imports', label: 'Imports' },
      { slug: 'settings', label: 'Settings' },
      { slug: 'settings/integrations', label: 'Integrations' },
    ],
  },
]

export default function WorkspaceSidebar({
  workspaceId,
}: {
  workspaceId: string
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const query = searchParams.toString()
  const activeSlug = pathname.split('/').slice(3).join('/')

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/60 pb-6 pr-4">
      {NAV_SECTIONS.map((section) => {
        const isCollapsed = collapsed[section.label]
        const hasActive = section.items.some((i) => i.slug === activeSlug || activeSlug.startsWith(i.slug + '/'))

        return (
          <div key={section.label}>
            <button
              onClick={() => toggleSection(section.label)}
              className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 transition hover:text-slate-300"
            >
              <span>{section.label}</span>
              <svg
                className={`h-3 w-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-0.5 pb-2">
                {section.items.map((item) => {
                  const href = `/workspace/${workspaceId}/${item.slug}`
                  // Preserve analytics-related query params only for analytics section
                  const analyticsParams = ['sell-in', 'sell-out', 'comparison', 'promo', 'pnl', 'sku-summary', 'company-summary', 'company-sku-detail', 'dashboard', 'insights']
                  const withQuery = query && analyticsParams.includes(item.slug) ? `${href}?${query}` : href
                  const isActive = activeSlug === item.slug

                  return (
                    <Link
                      key={item.slug}
                      href={withQuery}
                      aria-current={isActive ? 'page' : undefined}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        isActive
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
            {!isCollapsed || hasActive ? null : (
              <div className="flex flex-col gap-0.5 pb-2">
                {section.items
                  .filter((i) => i.slug === activeSlug)
                  .map((item) => {
                    const href = `/workspace/${workspaceId}/${item.slug}`
                    return (
                      <Link
                        key={item.slug}
                        href={href}
                        aria-current="page"
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {item.label}
                      </Link>
                    )
                  })}
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}
