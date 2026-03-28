export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-64 animate-pulse rounded-2xl bg-slate-800" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
            <div className="h-6 w-40 animate-pulse rounded-xl bg-slate-800" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((__, lineIndex) => (
                <div key={lineIndex} className="h-20 animate-pulse rounded-3xl bg-slate-800/70" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
