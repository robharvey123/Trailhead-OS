'use client'

import type { TaskRow } from '@/lib/workspace/types'
import { TaskCard } from './task-card'

const STATUS_COLUMNS: { key: TaskRow['status']; label: string; color: string }[] = [
  { key: 'open', label: 'Open', color: 'bg-slate-900/70' },
  { key: 'assigned', label: 'Assigned', color: 'bg-slate-900/50' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-950/30' },
  { key: 'done', label: 'Done', color: 'bg-emerald-950/30' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-rose-950/30' },
]

interface KanbanBoardProps {
  tasks: TaskRow[]
  onSelectTask: (task: TaskRow) => void
  onStatusChange: (taskId: string, status: TaskRow['status']) => void
}

export function KanbanBoard({ tasks, onSelectTask, onStatusChange }: KanbanBoardProps) {
  const tasksByStatus = new Map<string, TaskRow[]>()
  for (const col of STATUS_COLUMNS) tasksByStatus.set(col.key, [])
  for (const task of tasks) {
    const bucket = tasksByStatus.get(task.status)
    if (bucket) bucket.push(task)
    else tasksByStatus.get('open')!.push(task)
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, status: TaskRow['status']) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) onStatusChange(taskId, status)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_COLUMNS.map((col) => {
        const columnTasks = tasksByStatus.get(col.key) || []
        return (
          <div
            key={col.key}
            className={`flex w-64 min-w-[16rem] flex-shrink-0 flex-col rounded-2xl border border-slate-800 ${col.color} p-3`}
            onDrop={(e) => handleDrop(e, col.key)}
            onDragOver={handleDragOver}
          >
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
              {col.label}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-normal text-slate-500">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {columnTasks.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-600">Drop tasks here</div>
              )}
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <TaskCard task={task} onClick={() => onSelectTask(task)} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
