export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-48 animate-pulse rounded-2xl bg-slate-800" />
      <div className="grid gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-800/70" />
        ))}
      </div>
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-800/70" />
          ))}
        </div>
      </div>
    </div>
  )
}
