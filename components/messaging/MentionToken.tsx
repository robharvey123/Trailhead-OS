'use client'

import { useState } from 'react'

/**
 * A rendered @mention pill. There is no person-profile route in the app, so the
 * token isn't a link — instead it shows a small popover with the person's name
 * on hover/focus. Styling is accent-tinted to stand out from message text.
 */
export default function MentionToken({ fullName }: { fullName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-block">
      <span
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="cursor-default whitespace-nowrap rounded-control bg-[var(--accent-dim)] px-1 font-semibold text-[var(--accent-strong)]"
      >
        @{fullName}
      </span>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-[calc(100%+4px)] left-0 z-30 whitespace-nowrap rounded-control border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium not-italic text-[var(--text)] shadow-[var(--shadow-lg)]"
        >
          {fullName}
        </span>
      ) : null}
    </span>
  )
}
