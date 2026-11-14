import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The header of every page in Trailhead OS.
 *
 * One Georgia title at one size (26px, 22px below md). An optional eyebrow in
 * the label style, an optional count beside the title, one line of
 * description, actions on the right and tabs underneath.
 *
 * Give it at most one primary action. Further actions are secondary buttons or
 * go in an overflow menu.
 */
export interface PageHeaderProps {
  title: ReactNode
  /** Small label above the title: the section the page belongs to. */
  eyebrow?: ReactNode
  /** A count shown beside the title, for list pages. */
  count?: ReactNode
  /** One line under the title. */
  description?: ReactNode
  /** Buttons, right-aligned. At most one primary. */
  actions?: ReactNode
  /** A tab strip rendered under the header, flush with its bottom rule. */
  tabs?: ReactNode
  /** Link back to the parent list, shown above the title. */
  back?: { href: string; label: string }
  className?: string
}

export default function PageHeader({
  title,
  eyebrow,
  count,
  description,
  actions,
  tabs,
  back,
  className,
}: PageHeaderProps) {
  return (
    <header className={`mb-6 ${className ?? ''}`}>
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-3)] no-underline hover:text-[var(--accent-strong)]"
        >
          <span aria-hidden="true">‹</span> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="os-eyebrow mb-1">{eyebrow}</p> : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="os-page-title min-w-0 break-words">{title}</h1>
            {count !== undefined && count !== null ? <span className="topbar-count">{count}</span> : null}
          </div>
          {description ? (
            <p className="mt-1.5 max-w-3xl text-sm text-[var(--text-2)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs ? <div className="mt-4 border-b border-[var(--border)]">{tabs}</div> : null}
    </header>
  )
}
