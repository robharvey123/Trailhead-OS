export default function WorkstreamBoardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-56 animate-pulse rounded-2xl bg-slate-800" />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="min-w-[20rem] rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4"
          >
            <div className="h-6 w-28 animate-pulse rounded-xl bg-slate-800" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((__, lineIndex) => (
                <div key={lineIndex} className="h-28 animate-pulse rounded-3xl bg-slate-800/70" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
