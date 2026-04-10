export default function WeeklyReportLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-3 w-28 rounded bg-[#2A2A3A]" />
          <div className="mt-3 h-7 w-56 rounded bg-[#2A2A3A]" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-2xl bg-[#2A2A3A]" />
          <div className="h-10 w-36 rounded-2xl bg-[#2A2A3A]" />
          <div className="h-10 w-32 rounded-2xl bg-[#2A2A3A]" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] px-4 py-5 text-center">
            <div className="mx-auto h-8 w-12 rounded bg-[#2A2A3A]" />
            <div className="mx-auto mt-2 h-3 w-16 rounded bg-[#2A2A3A]" />
          </div>
        ))}
      </div>

      {/* Workstreams */}
      <div>
        <div className="mb-3 h-3 w-24 rounded bg-[#2A2A3A]" />
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] divide-y divide-[#2A2A3A]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-[#2A2A3A]" />
                <div className="h-4 w-28 rounded bg-[#2A2A3A]" />
              </div>
              <div className="flex gap-4">
                <div className="h-4 w-16 rounded bg-[#2A2A3A]" />
                <div className="h-4 w-16 rounded bg-[#2A2A3A]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div>
        <div className="mb-3 h-3 w-28 rounded bg-[#2A2A3A]" />
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] divide-y divide-[#2A2A3A]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="h-4 w-40 rounded bg-[#2A2A3A]" />
              <div className="h-4 w-24 rounded bg-[#2A2A3A]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
