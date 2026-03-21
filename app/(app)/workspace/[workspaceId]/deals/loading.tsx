export default function DealsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-12 rounded bg-slate-800" />
          <div className="mt-2 h-7 w-24 rounded bg-slate-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-slate-800" />
          <div className="h-8 w-28 rounded-lg bg-slate-800" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="h-3 w-16 rounded bg-slate-800" />
            <div className="h-5 w-32 rounded bg-slate-800" />
            <div className="h-4 w-24 rounded bg-slate-800" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 w-full rounded-lg bg-slate-800/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
