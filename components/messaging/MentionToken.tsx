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
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          background: 'var(--accent-dim, rgba(14,165,233,0.16))',
          color: 'var(--accent-strong, #0369a1)',
          borderRadius: 6,
          padding: '0 4px',
          fontWeight: 600,
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
      >
        @{fullName}
      </span>
      {open ? (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            zIndex: 30,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {fullName}
        </span>
      ) : null}
    </span>
  )
}
