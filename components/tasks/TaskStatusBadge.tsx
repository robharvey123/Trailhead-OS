import {
  ENGAGEMENT_TASK_STATUS_COLOURS,
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTaskStatus,
} from '@/lib/types'

/**
 * Single source of truth for rendering an engagement-task status chip: a colour
 * dot + label tinted with the status colour. The colour comes from the status
 * definition (ENGAGEMENT_TASK_STATUS_COLOURS) and is applied inline — Tailwind
 * can't compile dynamic hex, so we never build class strings from the colour.
 */
export default function TaskStatusBadge({
  status,
  className = '',
}: {
  status: EngagementTaskStatus
  className?: string
}) {
  const colour = ENGAGEMENT_TASK_STATUS_COLOURS[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`.trim()}
      style={{ backgroundColor: `${colour}20`, color: colour }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colour, flexShrink: 0 }} />
      {ENGAGEMENT_TASK_STATUS_LABELS[status]}
    </span>
  )
}
