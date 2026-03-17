'use client'

import type { TaskRow } from '@/lib/workspace/types'
import { WORKSPACE_CATEGORY_LABELS } from '@/lib/workspace/constants'

interface TaskCardProps {
  task: TaskRow
  onClick: () => void
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-rose-900/40 text-rose-300',
  medium: 'bg-amber-900/40 text-amber-300',
  low: 'bg-emerald-900/40 text-emerald-300',
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const isBlocked = (task.blocked_by_tasks || []).some(
    (dep) => dep.status !== 'done' && dep.status !== 'cancelled'
  )
  const checklist = task.checklist_items || []
  const doneCount = checklist.filter((c) => c.done).length

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-left shadow-sm transition hover:border-slate-600 hover:shadow-md"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight text-slate-200">
          {task.title}
        </span>
        {task.task_color && (
          <span
            className="mt-0.5 h-3 w-3 flex-shrink-0 rounded-full"
            style={{ backgroundColor: task.task_color }}
          />
        )}
      </div>

      {/* Meta row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {task.category && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            {WORKSPACE_CATEGORY_LABELS[task.category as keyof typeof WORKSPACE_CATEGORY_LABELS] || task.category}
          </span>
        )}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || ''}`}>
          {task.priority}
        </span>
        {isBlocked && (
          <span className="rounded bg-rose-900/40 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
            Blocked
          </span>
        )}
      </div>

      {/* Bottom row */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{task.scheduled_date}</span>
        <div className="flex items-center gap-2">
          {checklist.length > 0 && (
            <span>
              ✓ {doneCount}/{checklist.length}
            </span>
          )}
          {(task.assignments || []).length > 0 && (
            <span>
              👤 {task.assignments.length}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
