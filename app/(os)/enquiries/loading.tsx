import { PageHeaderSkeleton, SkeletonBar, TabsSkeleton } from '@/components/os/skeletons'

/** Enquiries is a card list, not a table: 8 tabs then rounded rows inside one os-card. */
export default function EnquiriesLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      <PageHeaderSkeleton action={false} />
      <TabsSkeleton count={8} />
      <div className="os-card p-6">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-[color:var(--border)] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <SkeletonBar className="h-5 w-48 rounded-lg" />
                  <SkeletonBar className="h-3 w-64" />
                </div>
                <div className="flex gap-2">
                  <SkeletonBar className="h-6 w-20 rounded-full" />
                  <SkeletonBar className="h-6 w-16 rounded-full" />
                </div>
              </div>
              <SkeletonBar className="mt-4 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
