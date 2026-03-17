'use client'

import { useState } from 'react'
import type { TaskRow } from '@/lib/workspace/types'
import { WORKSPACE_CATEGORY_LABELS } from '@/lib/workspace/constants'

interface ListViewProps {
  tasks: TaskRow[]
  onSelectTask: (task: TaskRow) => void
  onStatusChange: (taskId: string, status: TaskRow['status']) => void
}

type SortKey = 'scheduled_date' | 'title' | 'priority' | 'status' | 'category'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const STATUS_ORDER: Record<string, number> = { open: 0, assigned: 1, in_progress: 2, done: 3, cancelled: 4 }

function compareTasks(a: TaskRow, b: TaskRow, key: SortKey, asc: boolean): number {
  let cmp = 0
  switch (key) {
    case 'scheduled_date':
      cmp = a.scheduled_date.localeCompare(b.scheduled_date)
      break
    case 'title':
      cmp = a.title.localeCompare(b.title)
      break
    case 'priority':
      cmp = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      break
    case 'status':
      cmp = (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0)
      break
    case 'category':
      cmp = (a.category || '').localeCompare(b.category || '')
      break
  }
  return asc ? cmp : -cmp
}

const STATUS_OPTIONS: TaskRow['status'][] = ['open', 'assigned', 'in_progress', 'done', 'cancelled']

export function ListView({ tasks, onSelectTask, onStatusChange }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('scheduled_date')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = [...tasks].sort((a, b) => compareTasks(a, b, sortKey, sortAsc))

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '')

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950 text-left text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            {([
              ['scheduled_date', 'Date'],
              ['title', 'Task'],
              ['category', 'Category'],
              ['priority', 'Priority'],
              ['status', 'Status'],
            ] as [SortKey, string][]).map(([key, label]) => (
              <th
                key={key}
                onClick={() => toggleSort(key)}
                className="cursor-pointer px-4 py-3 transition hover:text-slate-200"
              >
                {label}
                {arrow(key)}
              </th>
            ))}
            <th className="px-4 py-3">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No tasks match your filters
              </td>
            </tr>
          )}
          {sorted.map((task) => (
            <tr
              key={task.id}
              onClick={() => onSelectTask(task)}
              className="cursor-pointer text-slate-200 transition hover:bg-white/5"
            >
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{task.scheduled_date}</td>
              <td className="px-4 py-2.5 font-medium text-slate-100">{task.title}</td>
              <td className="px-4 py-2.5 text-slate-400">
                {task.category
                  ? WORKSPACE_CATEGORY_LABELS[task.category as keyof typeof WORKSPACE_CATEGORY_LABELS] || task.category
                  : '—'}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    task.priority === 'high'
                      ? 'bg-rose-900/40 text-rose-300'
                      : task.priority === 'low'
                        ? 'bg-emerald-900/40 text-emerald-300'
                        : 'bg-amber-900/40 text-amber-300'
                  }`}
                >
                  {task.priority}
                </span>
              </td>
              <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={task.status}
                  onChange={(e) => onStatusChange(task.id, e.target.value as TaskRow['status'])}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-200"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2.5 text-slate-400">
                {(task.assignments || []).map((a) => a.profile_name).join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
