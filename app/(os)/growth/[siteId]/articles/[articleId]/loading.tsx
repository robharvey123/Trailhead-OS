export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="os-card h-24 animate-pulse p-5" />
      ))}
    </div>
  )
}
