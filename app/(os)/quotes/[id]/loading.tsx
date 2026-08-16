import { SkeletonBar } from '@/components/os/skeletons'

/** Quote detail: the 1.35fr / 360px split, long card stack on the left, sticky actions right. */
export default function QuoteDetailLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <div className="os-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <SkeletonBar className="h-3 w-24" />
                <SkeletonBar className="h-8 w-64 rounded-xl" />
              </div>
              <SkeletonBar className="h-6 w-24 rounded-full" />
            </div>
          </div>

          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="os-card space-y-3 p-6">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="h-5 w-48 rounded-lg" />
              <div className="space-y-2 pt-2">
                <SkeletonBar className="h-3 w-full" />
                <SkeletonBar className="h-3 w-5/6" />
                <SkeletonBar className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="os-card space-y-3 p-6">
              <SkeletonBar className="h-4 w-28" />
              <SkeletonBar className="h-10 w-full rounded-2xl" />
              <SkeletonBar className="h-10 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
