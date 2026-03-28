import { getPriorityClasses } from '@/lib/os'

interface PriorityBadgeProps {
  priority?: string | null
  className?: string
}

export default function PriorityBadge({
  priority = 'medium',
  className = '',
}: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getPriorityClasses(priority)} ${className}`.trim()}
    >
      {priority}
    </span>
  )
}
