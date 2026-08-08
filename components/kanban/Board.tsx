'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from '@dnd-kit/core'
import { ENGAGEMENT_TASK_BOARD_COLUMNS, type EngagementTaskStatus, type EngagementTaskWithRelations } from '@/lib/types'
import { moveTask } from '@/app/(os)/my-work/actions'
import KanbanColumn from './Column'

export type BoardSortMode = 'manual' | 'due_asc' | 'due_desc'

/** due_date compare with nulls always last, regardless of direction. */
function compareDue(a: string | null, b: string | null, dir: 1 | -1) {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b) * dir
}

export default function Board({
  initialTasks,
  minutesByTask,
  fromPath,
  sortMode = 'manual',
  dueFrom = '',
  dueTo = '',
  activeLabels,
  onToggleLabel,
}: {
  initialTasks: EngagementTaskWithRelations[]
  /** Total logged minutes per task id, for the per-card time chip. */
  minutesByTask?: Record<string, number>
  fromPath?: string
  /** 'manual' = position order (drag-drop). Date modes order each column by due_date. */
  sortMode?: BoardSortMode
  /** Inclusive due_date range (YYYY-MM-DD). Cards outside it — or undated — are hidden. */
  dueFrom?: string
  dueTo?: string
  /** Show only cards carrying every active label (AND). Empty/undefined = no label filter. */
  activeLabels?: string[]
  onToggleLabel?: (label: string) => void
}) {
  const router = useRouter()
  const openTask = (id: string) =>
    router.push(`/my-work/${id}${fromPath ? `?from=${encodeURIComponent(fromPath)}` : ''}`)
  const [tasks, setTasks] = useState(initialTasks)
  const [error, setError] = useState('')
  // Small activation distance so a plain click opens the card instead of dragging.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columnTasks = (s: EngagementTaskStatus) => {
    let list = tasks.filter((t) => t.status === s)
    if (activeLabels && activeLabels.length > 0) {
      list = list.filter((t) => activeLabels.every((l) => t.labels.includes(l)))
    }
    if (dueFrom) list = list.filter((t) => t.due_date != null && t.due_date >= dueFrom)
    if (dueTo) list = list.filter((t) => t.due_date != null && t.due_date <= dueTo)
    if (sortMode === 'due_asc' || sortMode === 'due_desc') {
      const dir = sortMode === 'due_desc' ? -1 : 1
      return list.sort((a, b) => compareDue(a.due_date, b.due_date, dir) || a.position - b.position)
    }
    return list.sort((a, b) => a.position - b.position)
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    // `over` is either another card id or a column (status) droppable id.
    const overTask = tasks.find((t) => t.id === over.id)
    const destStatus = (overTask ? overTask.status : over.id) as EngagementTaskStatus
    if (!ENGAGEMENT_TASK_BOARD_COLUMNS.includes(destStatus)) return

    const dest = tasks
      .filter((t) => t.status === destStatus && t.id !== active.id)
      .sort((a, b) => a.position - b.position)
    let index = dest.length
    if (overTask) {
      const i = dest.findIndex((t) => t.id === overTask.id)
      if (i >= 0) index = i
    }
    const prev = dest[index - 1]?.position
    const next = dest[index]?.position
    const newPos =
      prev != null && next != null ? (prev + next) / 2 : prev != null ? prev + 1 : next != null ? next - 1 : 0

    const snapshot = tasks
    setTasks((ts) => ts.map((t) => (t.id === active.id ? { ...t, status: destStatus, position: newPos } : t)))
    const res = await moveTask(activeTask.id, destStatus, newPos)
    if (res.error) {
      setTasks(snapshot) // revert optimistic update on failure
      setError(res.error)
    } else {
      setError('')
      router.refresh()
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      {error ? <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto' }}>
        {ENGAGEMENT_TASK_BOARD_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columnTasks(status)}
            minutesByTask={minutesByTask}
            onOpen={openTask}
            activeLabels={activeLabels}
            onToggleLabel={onToggleLabel}
          />
        ))}
      </div>
    </DndContext>
  )
}
