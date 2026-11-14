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
      className={`flex min-w-[240px] flex-[1_1_0] flex-col rounded-card border border-[var(--border)] p-2.5 ${isOver ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)]'}`}
    >
      <div className="panel-section-title">
        <TaskStatusBadge status={status} />
        <span className="td-num">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-10 flex-1">
          {tasks.map((t) => (<TaskCard key={t.id} task={t} loggedMinutes={minutesByTask?.[t.id] ?? 0} onOpen={onOpen} activeLabels={activeLabels} onToggleLabel={onToggleLabel} />))}
          {tasks.length === 0 ? <div className="p-2 text-xs text-[var(--text-3)]">—</div> : null}
        </div>
      </SortableContext>
    </div>
  )
}

export default memo(KanbanColumn)
