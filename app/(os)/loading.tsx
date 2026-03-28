export default function OsLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-72 md:border-r md:border-slate-800 md:bg-slate-950" />
      <main className="md:pl-72">
        <div className="mx-auto max-w-screen-2xl px-4 pb-8 pt-20 md:px-8 md:pt-8">
          <div className="h-10 w-48 animate-pulse rounded-2xl bg-slate-800" />
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
                <div className="h-6 w-32 animate-pulse rounded-xl bg-slate-800" />
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 4 }).map((__, lineIndex) => (
                    <div key={lineIndex} className="h-16 animate-pulse rounded-3xl bg-slate-800/70" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
