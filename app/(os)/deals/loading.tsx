export default function DealsLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-2)]" />
        <div className="h-9 w-48 animate-pulse rounded-xl bg-[var(--surface-2)]" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[28rem] w-[19rem] min-w-[19rem] animate-pulse rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)]"
          />
        ))}
      </div>
    </div>
  )
}
