'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

type NavItem = {
  slug: string
  label: string
}

export default function WorkspaceNav({
  items,
  workspaceId,
  basePath = '/workspace',
}: {
  items: NavItem[]
  workspaceId: string
  basePath?: string
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const query = searchParams.toString()
  const activeSlug = pathname.split('/').slice(3).join('/') || ''

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {items.map((item) => {
        const href =
          item.slug === 'dashboard'
            ? `${basePath}/${workspaceId}`
            : `${basePath}/${workspaceId}/${item.slug}`
        const analyticsPages = ['dashboard', 'insights', 'sell-in', 'sell-out', 'comparison', 'promo', 'pnl', 'sku-summary', 'company-summary', 'company-sku-detail']
        const withQuery = query && analyticsPages.includes(item.slug) ? `${href}?${query}` : href
        const isActive =
          (item.slug === 'dashboard' && activeSlug === '') ||
          activeSlug === item.slug ||
          (item.slug === 'holding' && activeSlug === 'holding')

        return (
          <Link
            key={item.slug}
            href={withQuery}
            aria-current={isActive ? 'page' : undefined}
            title={item.label}
            className={`whitespace-nowrap rounded-pill border px-3 py-1.5 no-underline transition ${
              isActive
                ? 'border-[var(--accent-strong)] bg-[var(--accent-dim)] text-[var(--accent-strong)]'
                : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-light)] hover:text-[var(--text)]'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
