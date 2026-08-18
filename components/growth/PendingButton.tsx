'use client'

import { useFormStatus } from 'react-dom'

/**
 * Submit button that reports the server action's progress. The Growth actions
 * (cluster generation, brief generation) take 10-40 seconds against the
 * Anthropic and DataForSEO APIs; without this the page looks inert and the
 * natural response is to click again, queuing duplicate work.
 */
export function PendingButton({
  children,
  pendingLabel,
  variant = 'secondary',
  className = '',
}: {
  children: React.ReactNode
  pendingLabel: string
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  const { pending } = useFormStatus()

  const base =
    variant === 'primary'
      ? 'rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)]'
      : 'rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]'

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base} ${className} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}
