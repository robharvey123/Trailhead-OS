'use client'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-400">{error.message || 'An unexpected error occurred'}</p>
      <button onClick={reset} className="mt-4 rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">
        Try again
      </button>
    </div>
  )
}
