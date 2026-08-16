import { SkeletonBar } from '@/components/os/skeletons'

/** Messages: one narrow (max 560px) panel — search field over a conversation list. */
export default function MessagesLoading() {
  return (
    <div className="thmock" aria-hidden>
      <div className="panel max-w-[560px] overflow-hidden">
        <div className="border-b border-[color:var(--border)] p-3">
          <SkeletonBar className="h-9 w-full rounded-lg" />
        </div>
        <div>
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-[color:var(--border)] px-4 py-3">
              <SkeletonBar className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBar className="h-3 w-1/3" />
                <SkeletonBar className="h-3 w-3/4" />
              </div>
              <SkeletonBar className="h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
