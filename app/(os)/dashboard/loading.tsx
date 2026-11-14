export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[780px] space-y-6">
      <div className="rounded-card border border-[color:var(--border)] bg-[var(--bg)] p-6">
        <div className="h-4 w-28 animate-pulse rounded-pill bg-[var(--surface-2)]" />
        <div className="mt-4 h-10 w-72 animate-pulse rounded-card bg-[var(--surface-2)]" />
        <div className="mt-3 h-4 w-full max-w-[420px] animate-pulse rounded-pill bg-[var(--surface-2)]" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-card border border-[color:var(--border)] bg-[var(--surface)] px-4 py-4">
              <div className="h-3 w-20 animate-pulse rounded-pill bg-[var(--surface-2)]" />
              <div className="mt-3 h-8 w-12 animate-pulse rounded-card bg-[var(--surface-2)]" />
            </div>
          ))}
        </div>
      </div>

      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="rounded-card border border-[color:var(--border)] bg-[var(--bg)] p-5">
          <div className="h-4 w-24 animate-pulse rounded-pill bg-[var(--surface-2)]" />
          <div className="mt-3 h-6 w-48 animate-pulse rounded-card bg-[var(--surface-2)]" />
          <div className="mt-2 h-4 w-full max-w-[320px] animate-pulse rounded-pill bg-[var(--surface-2)]" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: sectionIndex === 3 ? 5 : 3 }).map((__, lineIndex) => (
              <div key={lineIndex} className="h-20 animate-pulse rounded-card bg-[var(--surface-2)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
