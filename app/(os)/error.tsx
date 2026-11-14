'use client'

import { useEffect } from 'react'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

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
      <div className="os-card w-full max-w-lg">
        <EmptyState
          title="This page didn&rsquo;t load"
          description="The rest of the OS is still running. Only this page failed. Retrying is usually enough."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="primary" onClick={reset}>
                Try again
              </Button>
              <Button variant="secondary" href="/dashboard">
                Back to dashboard
              </Button>
            </div>
          }
        />
        {error.digest ? (
          <p className="os-mono border-t border-[var(--border)] px-6 py-3 text-center text-xs text-[var(--text-3)]">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  )
}
