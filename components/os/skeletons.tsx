/**
 * Shared building blocks for the OS `loading.tsx` skeletons.
 *
 * CLAUDE.md asks for a `loading.tsx` beside every async page, and the OS layout
 * is `force-dynamic`, so without one the user stares at the previous route until
 * the server round-trip lands. These pieces exist so ~16 route skeletons can
 * share one visual language (pulsing `--surface-2` bars on the page's real
 * chrome) instead of each inventing its own grey box.
 *
 * The vocabulary is copied from the skeletons that were already here
 * (`app/(os)/tasks/loading.tsx`, `app/(os)/reports/weekly/loading.tsx`): the
 * page's own container classes, filled with `animate-pulse bg-[var(--surface-2)]`
 * placeholders. Nothing new is invented — the shapes just follow the page.
 *
 * Server components: these render as part of `loading.tsx`, so no `'use client'`.
 */

/** One pulsing placeholder. Callers pass the Tailwind size they need. */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-[var(--surface-2)] ${className}`} />
}

/**
 * The `.thmock` panel idiom: topbar → optional stats bar → optional filter bar →
 * data table. Used by engagements, CRM accounts/contacts and the timesheet.
 */
export function PanelTableSkeleton({
  statItems = 0,
  filterbar = false,
  columns,
  rows = 8,
  actions = 2,
}: {
  /** How many equal-width cells the stats bar has. 0 = no stats bar. */
  statItems?: number
  filterbar?: boolean
  columns: number
  rows?: number
  /** Buttons on the right of the topbar. */
  actions?: number
}) {
  return (
    <div className="thmock" aria-hidden>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <SkeletonBar className="h-5 w-40 rounded-lg" />
          <SkeletonBar className="ml-2 h-4 w-20" />
          <div className="topbar-actions">
            {Array.from({ length: actions }).map((_, index) => (
              <SkeletonBar key={index} className="h-8 w-24 rounded-lg" />
            ))}
          </div>
        </div>

        {statItems > 0 ? (
          <div className="stats-bar">
            {Array.from({ length: statItems }).map((_, index) => (
              <div key={index} className="stat-item space-y-2">
                <SkeletonBar className="h-3 w-20" />
                <SkeletonBar className="h-5 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        ) : null}

        {filterbar ? (
          <div className="filterbar">
            <SkeletonBar className="h-8 w-56 rounded-lg" />
            <SkeletonBar className="h-8 w-32 rounded-lg" />
            <SkeletonBar className="h-8 w-32 rounded-lg" />
            <SkeletonBar className="h-8 w-32 rounded-lg" />
          </div>
        ) : null}

        <TableSkeleton columns={columns} rows={rows} />
      </div>
    </div>
  )
}

/** Header row + body rows for a `.thmock .data-table`. */
export function TableSkeleton({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>
                <SkeletonBar className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, cellIndex) => (
                <td key={cellIndex}>
                  <SkeletonBar className={cellIndex === 0 ? 'h-4 w-40' : 'h-4 w-16'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Eyebrow + title + optional right-hand action, as the `os-card` pages open. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        <SkeletonBar className="h-3 w-24" />
        <SkeletonBar className="h-8 w-56 rounded-xl" />
      </div>
      {action ? <SkeletonBar className="h-10 w-32 rounded-2xl" /> : null}
    </div>
  )
}

/** The row of rounded-full filter tabs that sits under most `os-card` page headers. */
export function TabsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBar key={index} className="h-9 w-24 rounded-full" />
      ))}
    </div>
  )
}

/**
 * `os-card` list page: header → optional stat cards → optional tabs → one card
 * holding a plain table. Used by invoicing, quotes and expenses.
 */
export function CardTablePageSkeleton({
  statCards = 0,
  tabs = 0,
  columns,
  rows = 8,
}: {
  statCards?: number
  tabs?: number
  columns: number
  rows?: number
}) {
  return (
    <div className="space-y-6" aria-hidden>
      <PageHeaderSkeleton />
      {statCards > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: statCards }).map((_, index) => (
            <div key={index} className="os-card space-y-3 p-5">
              <SkeletonBar className="h-3 w-28" />
              <SkeletonBar className="h-8 w-24 rounded-xl" />
            </div>
          ))}
        </div>
      ) : null}
      {tabs > 0 ? <TabsSkeleton count={tabs} /> : null}
      <div className="os-card p-6">
        <div className="space-y-3">
          <div className="flex gap-4 border-b border-[color:var(--border)] pb-3">
            {Array.from({ length: columns }).map((_, index) => (
              <SkeletonBar key={index} className="h-3 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="flex gap-4 py-1">
              {Array.from({ length: columns }).map((_, cellIndex) => (
                <SkeletonBar key={cellIndex} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Month grid for the calendar. Shared by `app/(os)/calendar/loading.tsx` (server
 * round-trip) and the `next/dynamic` boundary in `CalendarClientLazy` (FullCalendar
 * chunk download), so both waits look like the same screen.
 */
export function CalendarSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SkeletonBar className="h-8 w-40 rounded-2xl" />
        <div className="flex gap-2">
          <SkeletonBar className="h-9 w-24 rounded-xl" />
          <SkeletonBar className="h-9 w-36 rounded-xl" />
        </div>
      </div>
      <div className="os-card p-4">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonBar key={index} className="h-4" />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, index) => (
            <SkeletonBar key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
