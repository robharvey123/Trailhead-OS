'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Error boundary for the whole authenticated OS. Without this, an unhandled
 * render error on any of the ~67 OS pages falls through to Next's raw error
 * screen, outside the app shell.
 */
export default function OsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('OS route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="os-card max-w-lg p-8">
        <p className="os-eyebrow">Something broke</p>
        <h1 className="os-page-title mt-2">This page didn&rsquo;t load</h1>
        <p className="mt-3 text-sm text-[color:var(--text-2)]">
          The rest of the OS is still running — only this page failed. Retrying is
          usually enough; if it keeps failing, the details below identify the error.
        </p>

        {error.digest ? (
          <p className="os-mono mt-4 text-xs text-[color:var(--text-3)]">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
