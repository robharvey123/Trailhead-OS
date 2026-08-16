import { SkeletonBar } from '@/components/os/skeletons'

/**
 * Invoice detail: back link → header card → line items card → a
 * `1fr / 320px` split of notes against the summary/payment/action stack.
 */
export default function InvoiceDetailLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      <SkeletonBar className="h-4 w-40" />

      <div className="os-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-8 w-56 rounded-xl" />
            <div className="flex gap-2">
              <SkeletonBar className="h-6 w-20 rounded-full" />
              <SkeletonBar className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBar key={index} className="h-9 w-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="os-card space-y-3 p-6">
        <SkeletonBar className="h-4 w-28" />
        <div className="flex gap-4 border-b border-[color:var(--border)] pb-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBar key={index} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 py-1">
            {Array.from({ length: 4 }).map((_, cellIndex) => (
              <SkeletonBar key={cellIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="os-card space-y-3 p-6">
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-5/6" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="os-card space-y-3 p-6">
              <SkeletonBar className="h-4 w-24" />
              <SkeletonBar className="h-3 w-full" />
              <SkeletonBar className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
