import type { ReactNode } from 'react'

/**
 * One figure with its caption. The value is Inter 600 with tabular figures,
 * never Georgia. The caption uses the label style.
 */
interface StatCardProps {
  label: ReactNode
  value: ReactNode
  /** A short line under the value: a comparison, a unit, a date range. */
  sub?: ReactNode
  /** Colours the value only. Status colours are data, not brand. */
  tone?: 'default' | 'green' | 'amber' | 'red'
  /** Render without the card surface, for use inside a `.stats-bar`. */
  bare?: boolean
  className?: string
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: '',
  green: 'text-[var(--green-strong)]',
  amber: 'text-[var(--amber-strong)]',
  red: 'text-[var(--red-strong)]',
}

export default function StatCard({ label, value, sub, tone = 'default', bare = false, className }: StatCardProps) {
  return (
    <div className={`${bare ? 'stat-item' : 'os-card p-4'} ${className ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${TONE_CLASS[tone]}`}>{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  )
}
