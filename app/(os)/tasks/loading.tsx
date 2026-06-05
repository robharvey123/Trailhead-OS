export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="h-12 w-48 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
      <div className="os-card rounded-[2rem] p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    </div>
  )
}
