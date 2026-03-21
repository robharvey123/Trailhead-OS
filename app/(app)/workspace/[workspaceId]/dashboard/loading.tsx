export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-slate-800" />
        <div className="mt-3 h-7 w-56 rounded bg-slate-800" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
            <div className="h-3 w-24 rounded bg-slate-800" />
            <div className="h-6 w-16 rounded bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
            <div className="h-3 w-28 rounded bg-slate-800" />
            <div className="h-6 w-20 rounded bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900/70" />
    </div>
  )
}
