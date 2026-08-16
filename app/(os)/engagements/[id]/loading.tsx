import { SkeletonBar } from '@/components/os/skeletons'

/**
 * Engagement detail: thmock panel → topbar (back link, name, status, meta chips)
 * → 10-tab bar → a 1.4fr/1fr grid of overview cards.
 */
export default function EngagementDetailLoading() {
  return (
    <div className="thmock" aria-hidden>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <div className="space-y-2">
            <SkeletonBar className="h-3 w-28" />
            <SkeletonBar className="h-6 w-64 rounded-lg" />
          </div>
          <div className="topbar-actions">
            <SkeletonBar className="h-8 w-20 rounded-lg" />
            <SkeletonBar className="h-8 w-10 rounded-lg" />
          </div>
        </div>

        <div className="tabbar">
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonBar key={index} className="my-2 mr-2 h-7 w-20 shrink-0 rounded-lg" />
          ))}
        </div>

        <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                <SkeletonBar className="h-3 w-32" />
                <div className="mt-3 space-y-2">
                  <SkeletonBar className="h-4 w-full" />
                  <SkeletonBar className="h-4 w-4/5" />
                  <SkeletonBar className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                <SkeletonBar className="h-3 w-24" />
                <div className="mt-3 space-y-2">
                  <SkeletonBar className="h-4 w-full" />
                  <SkeletonBar className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
