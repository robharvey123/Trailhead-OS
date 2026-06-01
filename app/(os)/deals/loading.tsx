export default function DealsLoading() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-[#1A1A28]" />
        <div className="h-9 w-48 animate-pulse rounded-xl bg-[#1A1A28]" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[28rem] w-[19rem] min-w-[19rem] animate-pulse rounded-3xl border border-[#2A2A3A] bg-[#1A1A28]"
          />
        ))}
      </div>
    </div>
  )
}
