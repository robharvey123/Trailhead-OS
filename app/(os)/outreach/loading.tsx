import { SkeletonBar, TableSkeleton } from '@/components/os/skeletons'

/**
 * Outreach is a `.data-table` inside a white panel, under the page header.
 */
export default function OutreachLoading() {
  return (
    <div className="thmock" aria-hidden>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <SkeletonBar className="h-7 w-40 rounded-control" />
            <SkeletonBar className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBar key={index} className="h-8 w-24 rounded-control" />
            ))}
          </div>
        </div>
        <div className="panel">
          <TableSkeleton columns={8} rows={6} />
        </div>
      </div>
    </div>
  )
}
