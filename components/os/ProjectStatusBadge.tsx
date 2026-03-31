import type { ProjectStatus } from '@/lib/types'
import StatusBadge from './StatusBadge'

export default function ProjectStatusBadge({
  status,
  className = '',
}: {
  status: ProjectStatus
  className?: string
}) {
  return <StatusBadge status={status} kind="project" className={className} />
}