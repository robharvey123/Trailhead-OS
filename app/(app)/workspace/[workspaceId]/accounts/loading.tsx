export default function AccountsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-3 w-12 rounded bg-slate-800" />
          <div className="mt-2 h-7 w-32 rounded bg-slate-800" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-slate-800" />
      </div>
      <div className="h-10 w-64 rounded-lg bg-slate-800" />
      <div className="rounded-2xl border border-slate-800">
        <div className="border-b border-slate-800 p-4"><div className="h-4 w-full rounded bg-slate-800" /></div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-slate-800/50 p-4"><div className="h-4 w-full rounded bg-slate-800/60" /></div>
        ))}
      </div>
    </div>
  )
}
