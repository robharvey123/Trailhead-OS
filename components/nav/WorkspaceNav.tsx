'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
  const query = searchParams.toString()

  return (
    <nav className="flex flex-nowrap gap-2 overflow-x-auto pb-2 text-sm">
      {items.map((item) => {
        const href = `/workspace/${workspaceId}/${item.slug}`
        const withQuery = query ? `${href}?${query}` : href

        return (
          <Link
            key={item.slug}
            href={withQuery}
            className="whitespace-nowrap rounded-full border border-slate-800 px-3 py-1.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
