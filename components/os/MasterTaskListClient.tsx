'use client'

import { useMemo, useState } from 'react'
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
import { formatTaskDate, formatTaskSchedule } from '@/lib/os'
import type {
  Account,
  Contact,
  ProjectListItem,
  TaskPriority,
  TaskWithWorkstream,
  Workstream,
} from '@/lib/types'
import MasterTaskKanban from './MasterTaskKanban'
import PriorityBadge from './PriorityBadge'
import TaskSlideOver from './TaskSlideOver'
import WorkstreamBadge from './WorkstreamBadge'

interface MasterTaskListClientProps {
  initialTasks: TaskWithWorkstream[]
  workstreams: Workstream[]
  accounts: Account[]
  contacts: Contact[]
  projects: ProjectListItem[]
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const columnHelper = createColumnHelper<TaskWithWorkstream>()

function toggleFilterValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value]
}

export default function MasterTaskListClient({
  initialTasks,
  workstreams,
  accounts,
  contacts,
  projects,
}: MasterTaskListClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [selectedTask, setSelectedTask] = useState<TaskWithWorkstream | null>(
    null
  )
  const [creatingTask, setCreatingTask] = useState(false)
  const [workstreamFilter, setWorkstreamFilter] = useState<string[]>([])
  const [accountFilter, setAccountFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [masterOnly, setMasterOnly] = useState(false)
  const [bulkPriority, setBulkPriority] = useState<TaskPriority>('medium')
  const [bulkLoading, setBulkLoading] = useState(false)

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  )
  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts]
  )
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )
  const workstreamsById = useMemo(
    () => new Map(workstreams.map((workstream) => [workstream.id, workstream])),
    [workstreams]
  )

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (
          workstreamFilter.length > 0 &&
          (!task.workstream_id ||
            !workstreamFilter.includes(task.workstream_id))
        ) {
          return false
        }
        if (accountFilter && task.account_id !== accountFilter) {
          return false
        }
        if (projectFilter && task.project_id !== projectFilter) {
          return false
        }
        if (
          priorityFilter.length > 0 &&
          !priorityFilter.includes(task.priority)
        ) {
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
      }),
    [
      accountFilter,
      dueFrom,
      dueTo,
      masterOnly,
      projectFilter,
      priorityFilter,
      tasks,
      workstreamFilter,
    ]
  )

  const hasActiveFilters =
    workstreamFilter.length > 0 ||
    Boolean(accountFilter) ||
    Boolean(projectFilter) ||
    priorityFilter.length > 0 ||
    Boolean(dueFrom) ||
    Boolean(dueTo) ||
    masterOnly

  function clearAllFilters() {
    setWorkstreamFilter([])
    setAccountFilter('')
    setProjectFilter('')
    setPriorityFilter([])
    setDueFrom('')
    setDueTo('')
    setMasterOnly(false)
  }

  function mergeTask(nextTask: TaskWithWorkstream) {
    setTasks((current) => {
      const existingIndex = current.findIndex((task) => task.id === nextTask.id)

      if (existingIndex === -1) {
        return [nextTask, ...current]
      }

      return current.map((task) => (task.id === nextTask.id ? nextTask : task))
    })
  }

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
      columnHelper.display({
        id: 'project',
        header: 'Project',
        cell: (info) => {
          const project = info.row.original.project_id
            ? projectsById.get(info.row.original.project_id)
            : undefined
          return <span className="text-slate-300">{project?.name ?? info.row.original.project_name ?? '—'}</span>
        },
      }),
      columnHelper.display({
        id: 'account',
        header: 'Account',
        cell: (info) => {
          const account = info.row.original.account_id
            ? accountsById.get(info.row.original.account_id)
            : undefined
          return <span className="text-slate-300">{account?.name ?? '—'}</span>
        },
      }),
      columnHelper.display({
        id: 'contact',
        header: 'Contact',
        cell: (info) => {
          const contact = info.row.original.contact_id
            ? contactsById.get(info.row.original.contact_id)
            : undefined
          if (!contact) {
            return <span className="text-slate-400">—</span>
          }

          return (
            <div>
              <p className="text-slate-200">{contact.name}</p>
              {contact.company ? (
                <p className="text-xs text-slate-500">{contact.company}</p>
              ) : null}
            </div>
          )
        },
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => <PriorityBadge priority={info.getValue()} />,
      }),
      columnHelper.accessor('due_date', {
        header: 'Due date',
        cell: (info) =>
          formatTaskSchedule(info.getValue(), info.row.original.due_time),
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

  const selectedTasks = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)

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
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">
            Master list
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Tasks</h1>
          <p className="mt-2 text-sm text-slate-400">
            One table for every active task across the OS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-900/70 p-1">
            {(['table', 'kanban'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                  viewMode === mode
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCreatingTask(true)}
            className="relative z-10 rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
          >
            New task
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 md:grid-cols-2 xl:grid-cols-6">
        <div className="block md:col-span-2 xl:col-span-2">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Workstreams
          </span>
          <div className="flex min-h-[3.25rem] flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-3">
            {workstreams.map((workstream) => (
              <button
                key={workstream.id}
                type="button"
                onClick={() =>
                  setWorkstreamFilter((current) =>
                    toggleFilterValue(current, workstream.id)
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  workstreamFilter.includes(workstream.id)
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                {workstream.label}
              </button>
            ))}
            {workstreams.length === 0 ? (
              <span className="text-sm text-slate-500">
                No workstreams found
              </span>
            ) : null}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Account
          </span>
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Project
          </span>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="block md:col-span-2 xl:col-span-1">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Priority
          </span>
          <div className="flex min-h-[3.25rem] flex-wrap gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-3">
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() =>
                  setPriorityFilter((current) =>
                    toggleFilterValue(current, priority)
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-sm capitalize transition ${
                  priorityFilter.includes(priority)
                    ? 'border-sky-500/40 bg-sky-500/15 text-sky-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Due from
          </span>
          <input
            type="date"
            value={dueFrom}
            onChange={(event) => setDueFrom(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-[0.22em] text-slate-500">
            Due to
          </span>
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
          <span className="text-sm text-slate-200">
            Show only master to-do tasks
          </span>
        </label>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[2rem] border border-slate-800 bg-slate-900/40 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
            Active filters
          </span>

          {workstreamFilter.map((workstreamId) => (
            <button
              key={workstreamId}
              type="button"
              onClick={() =>
                setWorkstreamFilter((current) =>
                  current.filter((entry) => entry !== workstreamId)
                )
              }
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              {workstreamsById.get(workstreamId)?.label ?? 'Workstream'} ×
            </button>
          ))}

          {accountFilter ? (
            <button
              type="button"
              onClick={() => setAccountFilter('')}
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              {accountsById.get(accountFilter)?.name ?? 'Account'} ×
            </button>
          ) : null}

          {priorityFilter.map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() =>
                setPriorityFilter((current) =>
                  current.filter((entry) => entry !== priority)
                )
              }
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm capitalize text-sky-100"
            >
              {priority} ×
            </button>
          ))}

          {dueFrom ? (
            <button
              type="button"
              onClick={() => setDueFrom('')}
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              From {dueFrom} ×
            </button>
          ) : null}

          {dueTo ? (
            <button
              type="button"
              onClick={() => setDueTo('')}
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              To {dueTo} ×
            </button>
          ) : null}

          {masterOnly ? (
            <button
              type="button"
              onClick={() => setMasterOnly(false)}
              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100"
            >
              Master to-do only ×
            </button>
          ) : null}

          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {viewMode === 'table' && selectedTasks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-sm text-slate-300">
            {selectedTasks.length} selected
          </p>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() =>
              runBulkUpdate(
                async (task) => {
                  await apiFetch(`/api/os/tasks/${task.id}`, { method: 'DELETE' })
                },
                (task) => {
                  setTasks((current) =>
                    current.filter((entry) => entry.id !== task.id)
                  )
                }
              )
            }
            className="rounded-2xl border border-rose-500/30 px-4 py-2 text-sm text-rose-200"
          >
            Mark complete
          </button>

          <select
            value={bulkPriority}
            onChange={(event) =>
              setBulkPriority(event.target.value as TaskPriority)
            }
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
                  await apiFetch(`/api/os/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority: bulkPriority }),
                  })
                },
                (task) => {
                  setTasks((current) =>
                    current.map((entry) =>
                      entry.id === task.id
                        ? { ...entry, priority: bulkPriority }
                        : entry
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
              const shouldAdd = selectedTasks.some(
                (task) => !task.is_master_todo
              )
              runBulkUpdate(
                async (task) => {
                  await apiFetch(`/api/os/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_master_todo: shouldAdd }),
                  })
                },
                (task) => {
                  setTasks((current) =>
                    current.map((entry) =>
                      entry.id === task.id
                        ? { ...entry, is_master_todo: shouldAdd }
                        : entry
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

      {viewMode === 'kanban' ? (
        <MasterTaskKanban
          tasks={filteredTasks}
          workstreams={workstreams}
          onSelectTask={setSelectedTask}
          onTaskSaved={(task) => {
            mergeTask(task)
            if (selectedTask?.id === task.id) {
              setSelectedTask(task)
            }
          }}
        />
      ) : (
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
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
      )}

      <TaskSlideOver
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        workstreams={workstreams}
        accounts={accounts}
        contacts={contacts}
        projects={projects}
        onSaved={(task) => {
          mergeTask(task)
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
        accounts={accounts}
        contacts={contacts}
        onSaved={(task) => {
          mergeTask(task)
          setCreatingTask(false)
        }}
      />
    </div>
  )
}
