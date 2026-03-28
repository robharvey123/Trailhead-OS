'use client'

import { useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table'
import { apiFetch } from '@/lib/api-fetch'
import { formatTaskDate } from '@/lib/os'
import type { TaskPriority, TaskWithWorkstream, Workstream } from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import TaskSlideOver from './TaskSlideOver'
import WorkstreamBadge from './WorkstreamBadge'

interface MasterTaskListClientProps {
  initialTasks: TaskWithWorkstream[]
  workstreams: Workstream[]
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const columnHelper = createColumnHelper<TaskWithWorkstream>()

export default function MasterTaskListClient({
  initialTasks,
  workstreams,
}: MasterTaskListClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectedTask, setSelectedTask] = useState<TaskWithWorkstream | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [workstreamFilter, setWorkstreamFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [masterOnly, setMasterOnly] = useState(false)
  const [bulkPriority, setBulkPriority] = useState<TaskPriority>('medium')
  const [bulkLoading, setBulkLoading] = useState(false)

  const filteredTasks = tasks.filter((task) => {
    if (workstreamFilter.length > 0 && (!task.workstream_id || !workstreamFilter.includes(task.workstream_id))) {
      return false
    }
    if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority)) {
      return false
    }
    if (masterOnly && !task.is_master_todo) {
      return false
    }
    if (dueFrom && (!task.due_date || task.due_date < dueFrom)) {
      return false
    }
    if (dueTo && (!task.due_date || task.due_date > dueTo)) {
      return false
    }
    return true
  })

  const table = useReactTable({
    data: filteredTasks,
    columns: [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
          />
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <button
            type="button"
            onClick={() => setSelectedTask(info.row.original)}
            className="text-left font-medium text-slate-100 underline-offset-2 hover:underline"
          >
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.display({
        id: 'workstream',
        header: 'Workstream',
        cell: (info) => (
          <WorkstreamBadge
            label={info.row.original.workstream_label}
            slug={info.row.original.workstream_slug}
            colour={info.row.original.workstream_colour}
          />
        ),
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => <PriorityBadge priority={info.getValue()} />,
      }),
      columnHelper.accessor('due_date', {
        header: 'Due date',
        cell: (info) => formatTaskDate(info.getValue()),
      }),
      columnHelper.accessor('tags', {
        header: 'Tags',
        cell: (info) => (
          <div className="flex flex-wrap gap-2">
            {info.getValue().map((tag: string) => (
              <span
                key={tag}
                className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: (info) => formatTaskDate(info.getValue().slice(0, 10)),
      }),
    ],
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedTasks = table.getSelectedRowModel().rows.map((row) => row.original)

  async function runBulkUpdate(
    updater: (task: TaskWithWorkstream) => Promise<void>,
    afterUpdate: (task: TaskWithWorkstream) => void
  ) {
    setBulkLoading(true)

    try {
      for (const task of selectedTasks) {
        await updater(task)
        afterUpdate(task)
      }
      setRowSelection({})
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Master list</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Tasks</h1>
          <p className="mt-2 text-sm text-slate-400">
            One table for every active task across the OS.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreatingTask(true)}
          className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
        >
          New task
        </button>
      </div>

      <div className="grid gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2 xl:grid-cols-5">
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Workstreams</span>
          <select
            multiple
            value={workstreamFilter}
            onChange={(event) =>
              setWorkstreamFilter(Array.from(event.target.selectedOptions).map((option) => option.value))
            }
            className="min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {workstreams.map((workstream) => (
              <option key={workstream.id} value={workstream.id}>
                {workstream.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Priority</span>
          <select
            multiple
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(Array.from(event.target.selectedOptions).map((option) => option.value))
            }
            className="min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Due from</span>
          <input
            type="date"
            value={dueFrom}
            onChange={(event) => setDueFrom(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">Due to</span>
          <input
            type="date"
            value={dueTo}
            onChange={(event) => setDueTo(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
          <input
            type="checkbox"
            checked={masterOnly}
            onChange={(event) => setMasterOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-950"
          />
          <span className="text-sm text-slate-200">Show only master to-do tasks</span>
        </label>
      </div>

      {selectedTasks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-300">{selectedTasks.length} selected</p>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() =>
              runBulkUpdate(
                async (task) => {
                  await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
                },
                (task) => {
                  setTasks((current) => current.filter((entry) => entry.id !== task.id))
                }
              )
            }
            className="rounded-2xl border border-rose-500/30 px-4 py-2 text-sm text-rose-200"
          >
            Mark complete
          </button>

          <select
            value={bulkPriority}
            onChange={(event) => setBulkPriority(event.target.value as TaskPriority)}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100"
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={bulkLoading}
            onClick={() =>
              runBulkUpdate(
                async (task) => {
                  await apiFetch(`/api/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority: bulkPriority }),
                  })
                },
                (task) => {
                  setTasks((current) =>
                    current.map((entry) =>
                      entry.id === task.id ? { ...entry, priority: bulkPriority } : entry
                    )
                  )
                }
              )
            }
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100"
          >
            Change priority
          </button>

          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => {
              const shouldAdd = selectedTasks.some((task) => !task.is_master_todo)
              runBulkUpdate(
                async (task) => {
                  await apiFetch(`/api/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_master_todo: shouldAdd }),
                  })
                },
                (task) => {
                  setTasks((current) =>
                    current.map((entry) =>
                      entry.id === task.id ? { ...entry, is_master_todo: shouldAdd } : entry
                    )
                  )
                }
              )
            }}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-100"
          >
            Add/remove master flag
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[2rem] border border-slate-800 bg-slate-900/70">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.2em] text-slate-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left">
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-2"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-800">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="text-slate-200">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TaskSlideOver
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        workstreams={workstreams}
        onSaved={(task) => {
          setTasks((current) => {
            const next = current.filter((entry) => entry.id !== task.id)
            return [...next, task]
          })
          setSelectedTask(task)
        }}
        onDeleted={(taskId) => {
          setTasks((current) => current.filter((task) => task.id !== taskId))
          setSelectedTask(null)
        }}
      />

      <TaskSlideOver
        open={creatingTask}
        onClose={() => setCreatingTask(false)}
        workstreams={workstreams}
        onSaved={(task) => {
          setTasks((current) => [task, ...current])
          setCreatingTask(false)
        }}
      />
    </div>
  )
}
