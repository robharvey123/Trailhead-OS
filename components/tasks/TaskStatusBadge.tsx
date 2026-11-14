import {
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTaskStatus,
} from '@/lib/types'

/**
 * Single source of truth for rendering an engagement-task status chip: a dot
 * and a label. Each status maps to one of the OS status tones (a strong type
 * colour on its dim ground), so the chip reads the brand tokens and never
 * carries a hex value of its own.
 */
const STATUS_TONE: Record<EngagementTaskStatus, string> = {
  backlog: 'status-grey',
  in_progress: 'status-accent',
  review: 'status-amber',
  done: 'status-emerald',
  cancelled: 'status-red',
}

export default function TaskStatusBadge({
  status,
  className = '',
}: {
  status: EngagementTaskStatus
  className?: string
}) {
  return (
    <span className={`status-badge ${STATUS_TONE[status]} ${className}`.trim()}>
      {ENGAGEMENT_TASK_STATUS_LABELS[status]}
    </span>
  )
}
