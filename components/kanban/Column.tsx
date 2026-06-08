'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ENGAGEMENT_TASK_STATUS_LABELS, type EngagementTaskStatus, type EngagementTaskWithRelations } from '@/lib/types'
import TaskCard from './Card'

export default function KanbanColumn({
  status,
  tasks,
  onOpen,
  activeLabels,
  onToggleLabel,
}: {
  status: EngagementTaskStatus
  tasks: EngagementTaskWithRelations[]
  onOpen: (id: string) => void
  activeLabels?: string[]
  onToggleLabel?: (label: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      style={{ flex: '1 1 0', minWidth: 240, background: isOver ? 'var(--surface-2)' : 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column' }}
    >
      <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>{ENGAGEMENT_TASK_STATUS_LABELS[status]}</span>
        <span className="td-mono" style={{ color: 'var(--text-3)' }}>{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div style={{ minHeight: 40, flex: 1 }}>
          {tasks.map((t) => (<TaskCard key={t.id} task={t} onOpen={onOpen} activeLabels={activeLabels} onToggleLabel={onToggleLabel} />))}
          {tasks.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>—</div> : null}
        </div>
      </SortableContext>
    </div>
  )
}
