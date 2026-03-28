import { getWorkstreamColourClasses } from '@/lib/os'

interface WorkstreamBadgeProps {
  label?: string | null
  slug?: string | null
  colour?: string | null
  className?: string
}

export default function WorkstreamBadge({
  label,
  slug,
  colour,
  className = '',
}: WorkstreamBadgeProps) {
  const classes = getWorkstreamColourClasses(colour ?? slug)

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${classes.badge} ${className}`.trim()}
    >
      <span className={`h-2 w-2 rounded-full ${classes.dot}`} />
      {label ?? 'Unassigned'}
    </span>
  )
}
