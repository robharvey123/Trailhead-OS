import type { ReactNode } from 'react'

/**
 * A status pill. The tones are the existing status token pairs (a strong
 * colour for the type on its dim ground), which are data, not brand.
 */
export type BadgeTone = 'accent' | 'green' | 'amber' | 'red' | 'emerald' | 'grey'

interface BadgeProps {
  tone?: BadgeTone
  /** Hide the leading dot. */
  plain?: boolean
  className?: string
  children: ReactNode
}

export default function Badge({ tone = 'grey', plain = false, className, children }: BadgeProps) {
  return (
    <span className={`status-badge status-${tone} ${plain ? 'no-dot' : ''} ${className ?? ''}`}>{children}</span>
  )
}
