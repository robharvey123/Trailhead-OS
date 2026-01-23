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
}: {
  items: NavItem[]
  workspaceId: string
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const query = searchParams.toString()
  const activeSlug = pathname.split('/').slice(3, 4)[0] ?? ''

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {items.map((item) => {
        const href = `/workspace/${workspaceId}/${item.slug}`
        const withQuery = query ? `${href}?${query}` : href
        const isActive = activeSlug === item.slug

        return (
          <Link
            key={item.slug}
            href={withQuery}
            aria-current={isActive ? 'page' : undefined}
            title={item.label}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 transition ${
              isActive
                ? 'border-white/60 bg-white/10 text-white'
                : 'border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
