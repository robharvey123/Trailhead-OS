export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      <div className="os-card h-36 animate-pulse p-6" />
      <div className="os-card h-72 animate-pulse p-6" />
    </div>
  )
}
