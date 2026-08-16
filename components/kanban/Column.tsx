'use client'

import { memo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type EngagementTaskStatus, type EngagementTaskWithRelations } from '@/lib/types'
import TaskStatusBadge from '@/components/tasks/TaskStatusBadge'
import TaskCard from './Card'

/**
 * Memoised for the same reason as TaskCard, one level up: Board's post-drop
 * announcement/error state changes must not walk four columns' worth of cards.
 * `tasks` is handed in from Board's `tasksByColumn` useMemo, so its identity only
 * changes when that column's contents actually change.
 */
function KanbanColumn({
  status,
  tasks,
  minutesByTask,
  onOpen,
  activeLabels,
  onToggleLabel,
}: {
  status: EngagementTaskStatus
  tasks: EngagementTaskWithRelations[]
  minutesByTask?: Record<string, number>
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
        <TaskStatusBadge status={status} />
        <span className="td-mono" style={{ color: 'var(--text-3)' }}>{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div style={{ minHeight: 40, flex: 1 }}>
          {tasks.map((t) => (<TaskCard key={t.id} task={t} loggedMinutes={minutesByTask?.[t.id] ?? 0} onOpen={onOpen} activeLabels={activeLabels} onToggleLabel={onToggleLabel} />))}
          {tasks.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>—</div> : null}
        </div>
      </SortableContext>
    </div>
  )
}

export default memo(KanbanColumn)
