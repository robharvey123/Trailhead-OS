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

  // The look comes from the shared `.btn` classes; `className` is for layout and `btn-sm`.
  const base = variant === 'primary' ? 'btn btn-primary' : 'btn btn-ghost'

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base} ${className}`.trim()}
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
