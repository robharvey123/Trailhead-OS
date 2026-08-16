'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The OS had no top chrome at all, so every page invented its own header and
 * there was nowhere for search or a breadcrumb to live. This is that place:
 * where am I, and how do I get anywhere else.
 */

/** Route segments that are ids rather than words — shown as a short reference. */
const ID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-|^\d+$/i

const LABELS: Record<string, string> = {
  'my-work': 'My work',
  crm: 'CRM',
  os: 'OS',
  api: 'API',
}

function labelFor(segment: string) {
  if (LABELS[segment]) return LABELS[segment]
  if (ID_LIKE.test(segment)) return segment.slice(0, 8)
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
}

export default function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((segment, index) => ({
    label: labelFor(segment),
    href: '/' + segments.slice(0, index + 1).join('/'),
    isLast: index === segments.length - 1,
  }))

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-between gap-4 border-b border-[color:var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur md:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <li className="shrink-0">
            <Link href="/dashboard" className="text-[color:var(--text-3)] transition hover:text-[color:var(--text)]">
              OS
            </Link>
          </li>
          {crumbs.map((crumb) => (
            <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden="true" className="text-[color:var(--text-3)]">/</span>
              {crumb.isLast ? (
                <span aria-current="page" className="truncate font-medium text-[color:var(--text)]">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate text-[color:var(--text-3)] transition hover:text-[color:var(--text)]">
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm text-[color:var(--text-3)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-strong)]"
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="os-mono hidden rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
    </div>
  )
}
