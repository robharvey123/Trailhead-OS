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
import { formatTaskDate, formatTaskSchedule, getWorkstreamColourClasses } from '@/lib/os'
import type {
  Account,
  Contact,
  ProjectListItem,
  TaskPriority,
  TaskWithWorkstream,
  Workstream,
} from '@/lib/types'
import ConfirmDialog from './ConfirmDialog'
import MasterTaskKanban from './MasterTaskKanban'
import PriorityBadge from './PriorityBadge'
import TaskEmailModal from './TaskEmailModal'
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
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailModalTasks, setEmailModalTasks] = useState<TaskWithWorkstream[]>([])
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false)
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false)
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
            className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)]"
          />
        ),
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <button
            type="button"
            onClick={() => setSelectedTask(info.row.original)}
            className="text-left font-medium text-[color:var(--text)] underline-offset-2 hover:underline"
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
          return <span className="text-[color:var(--text-2)]">{project?.name ?? info.row.original.project_name ?? '—'}</span>
        },
      }),
      columnHelper.display({
        id: 'account',
        header: 'Account',
        cell: (info) => {
          const account = info.row.original.account_id
            ? accountsById.get(info.row.original.account_id)
            : undefined
          return <span className="text-[color:var(--text-2)]">{account?.name ?? '—'}</span>
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
            return <span className="text-[color:var(--text-2)]">—</span>
          }

          return (
            <div>
              <p className="text-[color:var(--text)]">{contact.name}</p>
              {contact.company ? (
                <p className="text-xs text-[color:var(--text-2)]">{contact.company}</p>
              ) : null}
            </div>
          )
        },
      }),
      columnHelper.accessor('priority', {
        header: 'Priority',
        cell: (info) => {
          const p = info.getValue()
          const cls =
            p === 'critical'
              ? 'text-[color:var(--red-strong)] font-bold text-[11px] uppercase tracking-[1px]'
              : p === 'urgent'
                ? 'text-[color:var(--red-strong)] font-semibold text-[11px] uppercase tracking-[1px]'
                : p === 'high'
                  ? 'text-[color:var(--red-strong)] text-[11px] uppercase tracking-[1px]'
                  : p === 'medium'
                    ? 'text-[color:var(--amber-strong)] text-[11px] uppercase tracking-[1px]'
                    : 'text-[color:var(--text-3)] text-[11px] uppercase tracking-[1px]'
          return <span className={cls}>{p}</span>
        },
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
                className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[color:var(--text-2)]"
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
          <p className="os-eyebrow text-[color:var(--accent-strong)] pb-2 border-b border-[color:var(--border)] mb-4">
            Master list
          </p>
          <h1 className="os-page-title mt-2">Tasks</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            One table for every active task across the OS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-1">
            {(['table', 'kanban'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                  viewMode === mode
                    ? 'bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                    : 'text-[color:var(--text-2)] hover:text-[color:var(--text)]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCreatingTask(true)}
            className="relative z-10 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            New task
          </button>
        </div>
      </div>

      <div className="os-card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="block md:col-span-2 xl:col-span-2">
          <span className="os-eyebrow mb-2 block">
            Workstreams
          </span>
          <div className="flex min-h-[3.25rem] flex-wrap gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] p-3">
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
                    ? 'border-transparent bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                    : 'border-[color:var(--border)] bg-[var(--surface)] text-[color:var(--text-2)] hover:border-[color:var(--accent)]'
                }`}
              >
                {workstream.label}
              </button>
            ))}
            {workstreams.length === 0 ? (
              <span className="text-sm text-[color:var(--text-2)]">
                No workstreams found
              </span>
            ) : null}
          </div>
        </div>

        <label className="block">
          <span className="os-eyebrow mb-2 block">
            Account
          </span>
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="os-select w-full"
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
          <span className="os-eyebrow mb-2 block">
            Project
          </span>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="os-select w-full"
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
          <span className="os-eyebrow mb-2 block">
            Priority
          </span>
          <div className="flex min-h-[3.25rem] flex-wrap gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] p-3">
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
                    ? 'border-transparent bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                    : 'border-[color:var(--border)] bg-[var(--surface)] text-[color:var(--text-2)] hover:border-[color:var(--accent)]'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="os-eyebrow mb-2 block">
            Due from
          </span>
          <input
            type="date"
            value={dueFrom}
            onChange={(event) => setDueFrom(event.target.value)}
            className="os-input w-full"
          />
        </label>

        <label className="block">
          <span className="os-eyebrow mb-2 block">
            Due to
          </span>
          <input
            type="date"
            value={dueTo}
            onChange={(event) => setDueTo(event.target.value)}
            className="os-input w-full"
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <input
            type="checkbox"
            checked={masterOnly}
            onChange={(event) => setMasterOnly(event.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)]"
          />
          <span className="text-sm text-[color:var(--text-2)]">
            Show only master to-do tasks
          </span>
        </label>
      </div>

      {hasActiveFilters ? (
        <div className="os-card flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="os-eyebrow">
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
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm text-[color:var(--accent-strong)]"
            >
              {workstreamsById.get(workstreamId)?.label ?? 'Workstream'} ×
            </button>
          ))}

          {accountFilter ? (
            <button
              type="button"
              onClick={() => setAccountFilter('')}
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm text-[color:var(--accent-strong)]"
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
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm capitalize text-[color:var(--accent-strong)]"
            >
              {priority} ×
            </button>
          ))}

          {dueFrom ? (
            <button
              type="button"
              onClick={() => setDueFrom('')}
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm text-[color:var(--accent-strong)]"
            >
              From {dueFrom} ×
            </button>
          ) : null}

          {dueTo ? (
            <button
              type="button"
              onClick={() => setDueTo('')}
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm text-[color:var(--accent-strong)]"
            >
              To {dueTo} ×
            </button>
          ) : null}

          {masterOnly ? (
            <button
              type="button"
              onClick={() => setMasterOnly(false)}
              className="rounded-full border border-transparent bg-[var(--accent-dim)] px-3 py-1 text-sm text-[color:var(--accent-strong)]"
            >
              Master to-do only ×
            </button>
          ) : null}

          <button
            type="button"
            onClick={clearAllFilters}
            className="ml-auto rounded-full border border-[color:var(--border)] px-3 py-1 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {viewMode === 'table' && selectedTasks.length > 0 ? (
        <div className="os-card flex flex-wrap items-center gap-3 p-4">
          <p className="text-sm text-[color:var(--text-2)]">
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
            className="rounded-2xl border border-[color:var(--red)] px-4 py-2 text-sm text-[color:var(--red-strong)]"
          >
            Mark complete
          </button>

          <select
            value={bulkPriority}
            onChange={(event) =>
              setBulkPriority(event.target.value as TaskPriority)
            }
            className="os-select"
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
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)]"
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
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)]"
          >
            Add/remove master flag
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailModalTasks(selectedTasks)
              setEmailModalOpen(true)
            }}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)]"
          >
            Email selected
          </button>
          <button
            type="button"
            onClick={() => setHardDeleteOpen(true)}
            className="rounded-2xl border border-[color:var(--red)] bg-[var(--red-dim)] px-4 py-2 text-sm font-medium text-[color:var(--red-strong)]"
          >
            Delete selected
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={hardDeleteOpen}
        onOpenChange={setHardDeleteOpen}
        title="Delete tasks permanently"
        description={`This will permanently delete ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}. This cannot be undone.`}
        confirmLabel="Delete all"
        variant="destructive"
        loading={hardDeleteLoading}
        items={selectedTasks.slice(0, 8).map((t) => t.title)}
        itemsLabel="Tasks to delete"
        onConfirm={async () => {
          setHardDeleteLoading(true)
          try {
            for (const task of selectedTasks) {
              await apiFetch(`/api/os/tasks/${task.id}?hard=true`, { method: 'DELETE' })
              setTasks((current) => current.filter((t) => t.id !== task.id))
            }
            setRowSelection({})
            setHardDeleteOpen(false)
          } catch {
            // individual failures still removed above
          } finally {
            setHardDeleteLoading(false)
          }
        }}
      />

      <TaskEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        tasks={emailModalTasks}
      />

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
        <div className="os-card overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
            <thead className="bg-[var(--surface-2)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--text-2)]">
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
            <tbody className="divide-y divide-[color:var(--border)]">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="text-[color:var(--text)] hover:bg-[var(--surface-2)] transition-colors">
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
