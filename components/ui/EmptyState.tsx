import type { ReactNode } from 'react'

/**
 * What a list, table or page shows when there is nothing in it: a title, one
 * line saying what belongs here, and one action that fixes it.
 */
interface EmptyStateProps {
  title: ReactNode
  /** One line. */
  description?: ReactNode
  /** One action, usually a primary `Button`. */
  action?: ReactNode
  className?: string
}

export default function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`empty ${className ?? ''}`}>
      <p className="empty-title">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--text-2)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
