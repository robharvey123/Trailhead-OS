'use client'

import { useState } from 'react'
import { PendingButton } from '@/components/growth/PendingButton'

/**
 * Two-step submit for an action that destroys something. The first click arms
 * it and states what will be lost; only the second click submits, and from
 * there PendingButton takes over so the wait is visible and the button cannot
 * be clicked twice.
 *
 * Inline rather than a modal: the Growth screens are server components whose
 * actions are plain <form action={…}> submits, and keeping the real submit
 * button inside that form is what makes useFormStatus report progress.
 */
export function ConfirmPendingButton({
  children,
  confirmLabel,
  warning,
  pendingLabel,
  variant = 'secondary',
}: {
  children: React.ReactNode
  confirmLabel: string
  warning: string
  pendingLabel: string
  variant?: 'primary' | 'secondary'
}) {
  const [armed, setArmed] = useState(false)

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
      >
        {children}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <p className="text-sm text-amber-800 dark:text-amber-200">{warning}</p>
      <div className="mt-3 flex items-center gap-2">
        <PendingButton variant={variant} pendingLabel={pendingLabel}>
          {confirmLabel}
        </PendingButton>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-2xl px-3 py-2 text-sm text-[color:var(--text-2)] transition hover:text-[color:var(--text)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
