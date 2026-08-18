export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="os-card h-32 animate-pulse p-6" />
        ))}
      </div>
    </div>
  )
}
