import { SkeletonBar } from '@/components/os/skeletons'

/**
 * Inbox: thmock panel → topbar → the three-pane mail grid (folder rail, thread
 * list, reader). Matches the `.inbox` grid template so nothing jumps when the
 * real client mounts its own in-pane shimmer skeletons.
 */
export default function InboxLoading() {
  return (
    <div className="thmock" aria-hidden>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <SkeletonBar className="h-5 w-24 rounded-lg" />
          <SkeletonBar className="ml-2 h-4 w-16" />
          <div className="topbar-actions">
            <SkeletonBar className="h-8 w-24 rounded-lg" />
            <SkeletonBar className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        <div className="inbox">
          <div className="folders space-y-2 p-3">
            <SkeletonBar className="h-3 w-16" />
            {Array.from({ length: 7 }).map((_, index) => (
              <SkeletonBar key={index} className="h-8 w-full rounded-lg" />
            ))}
          </div>
          <div className="threads">
            <div className="threads-search p-3">
              <SkeletonBar className="h-8 w-full rounded-lg" />
            </div>
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="thread">
                <div className="thread-row">
                  <SkeletonBar className="h-3 flex-1" />
                  <SkeletonBar className="h-3 w-8" />
                </div>
                <SkeletonBar className="mt-2 h-3 w-[70%]" />
                <SkeletonBar className="mt-2 h-3 w-[90%]" />
              </div>
            ))}
          </div>
          <div className="reader">
            <div className="reader-header space-y-3">
              <SkeletonBar className="h-6 w-2/3 rounded-lg" />
              <div className="flex gap-2">
                <SkeletonBar className="h-5 w-24 rounded-lg" />
                <SkeletonBar className="h-5 w-20 rounded-lg" />
              </div>
            </div>
            <div className="reader-body space-y-3 py-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonBar key={index} className={index % 3 === 2 ? 'h-3 w-3/5' : 'h-3 w-full'} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
