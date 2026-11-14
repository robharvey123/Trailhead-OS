export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-20 rounded-control bg-[var(--surface-3)]" />
        <div className="mt-3 h-7 w-56 rounded-control bg-[var(--surface-3)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="os-card space-y-2 p-4">
            <div className="h-3 w-24 rounded-control bg-[var(--surface-3)]" />
            <div className="h-6 w-16 rounded-control bg-[var(--surface-3)]" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="os-card space-y-3 p-4">
            <div className="h-3 w-28 rounded-control bg-[var(--surface-3)]" />
            <div className="h-6 w-20 rounded-control bg-[var(--surface-3)]" />
          </div>
        ))}
      </div>
      <div className="os-card h-64" />
    </div>
  )
}
