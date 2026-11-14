'use client'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-lg font-semibold text-[var(--text)]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[var(--text-3)]">{error.message || 'An unexpected error occurred'}</p>
      <button onClick={reset} className="btn btn-primary btn-sm mt-4">
        Try again
      </button>
    </div>
  )
}
