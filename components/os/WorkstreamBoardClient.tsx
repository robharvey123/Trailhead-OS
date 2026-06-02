'use client'

import { useState } from 'react'
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import { formatTaskSchedule, getWorkstreamColourClasses } from '@/lib/os'
import type { BoardColumn, ProjectListItem, TaskWithWorkstream, Workstream } from '@/lib/types'
import { apiFetch } from '@/lib/api-fetch'
import PriorityBadge from './PriorityBadge'
import ProjectsSection from './ProjectsSection'
import QuickAddTask from './QuickAddTask'
import TaskCard from './TaskCard'
import TaskSlideOver from './TaskSlideOver'

interface WorkstreamBoardClientProps {
  workstream: Workstream
  workstreams: Workstream[]
  columns: BoardColumn[]
  initialTasks: TaskWithWorkstream[]
  projects: ProjectListItem[]
}

const columnHelper = createColumnHelper<TaskWithWorkstream>()

function getEffectiveColumnId(task: TaskWithWorkstream, columns: BoardColumn[]) {
  return task.column_id ?? columns[0]?.id ?? null
}

function SortableTask({
  task,
  columns,
  onSelect,
}: {
  task: TaskWithWorkstream
  columns: BoardColumn[]
  onSelect: (task: TaskWithWorkstream) => void
}) {
  const effectiveColumnId = getEffectiveColumnId(task, columns)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      taskId: task.id,
      columnId: effectiveColumnId,
    },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="touch-none"
    >
      <TaskCard
        task={task}
        onClick={() => onSelect(task)}
        buttonProps={{
          ...attributes,
          ...listeners,
          className: 'touch-none cursor-grab active:cursor-grabbing',
        }}
      />
    </div>
  )
}

function DroppableColumn({
  column,
  children,
}: {
  column: BoardColumn
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-4 transition ${
        isOver
          ? 'border-[color:var(--accent)] bg-[var(--accent-dim)]'
          : 'border-[color:var(--border)] bg-white'
      }`}
    >
      {children}
    </div>
  )
}

export default function WorkstreamBoardClient({
  workstream,
  workstreams,
  columns,
  initialTasks,
  projects,
}: WorkstreamBoardClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState<TaskWithWorkstream | null>(null)
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [sorting, setSorting] = useState<SortingState>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const colourClasses = getWorkstreamColourClasses(workstream.colour)

  const tasksByColumn = columns.reduce<Record<string, TaskWithWorkstream[]>>((groups, column) => {
    groups[column.id] = tasks
      .filter((task) => getEffectiveColumnId(task, columns) === column.id)
      .sort((left, right) => left.sort_order - right.sort_order)
    return groups
  }, {})

  function setColumnTaskOrder(columnId: string, taskIds: string[], nextTasks: TaskWithWorkstream[]) {
    taskIds.forEach((taskId, index) => {
      const task = nextTasks.find((entry) => entry.id === taskId)
      if (task) {
        task.column_id = columnId
        task.sort_order = index
      }
    })
  }

  async function persistColumns(columnIds: string[], sourceTasks: TaskWithWorkstream[]) {
    const payload = sourceTasks
      .filter((task) => {
        const columnId = getEffectiveColumnId(task, columns)
        return columnId ? columnIds.includes(columnId) : false
      })
      .map((task) => ({
        id: task.id,
        sort_order: task.sort_order,
        column_id: getEffectiveColumnId(task, columns),
      }))

    await apiFetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: payload }),
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null

    if (!overId) {
      return
    }

    const activeTask = tasks.find((task) => task.id === activeId)
    if (!activeTask) {
      return
    }

    const overTask = tasks.find((task) => task.id === overId)
    const sourceColumnId = getEffectiveColumnId(activeTask, columns)
    const destinationColumnId = columns.some((column) => column.id === overId)
      ? overId
      : overTask
        ? getEffectiveColumnId(overTask, columns)
        : sourceColumnId

    if (!sourceColumnId || !destinationColumnId) {
      return
    }

    const nextTasks = tasks.map((task) => ({ ...task }))
    const sourceIds = nextTasks
      .filter((task) => getEffectiveColumnId(task, columns) === sourceColumnId)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((task) => task.id)

    const destinationIds = sourceColumnId === destinationColumnId
      ? [...sourceIds]
      : nextTasks
          .filter((task) => getEffectiveColumnId(task, columns) === destinationColumnId)
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((task) => task.id)

    if (sourceColumnId === destinationColumnId) {
      const oldIndex = sourceIds.indexOf(activeId)
      const newIndex = overTask ? sourceIds.indexOf(overId) : sourceIds.length - 1
      const reordered = arrayMove(sourceIds, oldIndex, newIndex)
      setColumnTaskOrder(sourceColumnId, reordered, nextTasks)
      setTasks(nextTasks)
      await persistColumns([sourceColumnId], nextTasks)
      return
    }

    const nextSourceIds = sourceIds.filter((taskId) => taskId !== activeId)
    const insertIndex = overTask ? destinationIds.indexOf(overId) : destinationIds.length
    const nextDestinationIds = [...destinationIds]
    nextDestinationIds.splice(insertIndex, 0, activeId)

    setColumnTaskOrder(sourceColumnId, nextSourceIds, nextTasks)
    setColumnTaskOrder(destinationColumnId, nextDestinationIds, nextTasks)
    setTasks(nextTasks)
    await persistColumns([sourceColumnId, destinationColumnId], nextTasks)
  }

  const table = useReactTable({
    data: [...tasks].sort((left, right) => left.sort_order - right.sort_order),
    columns: [
      columnHelper.accessor('title', {
        header: 'Task',
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
        id: 'column',
        header: 'Column',
        cell: (info) => columns.find((column) => column.id === getEffectiveColumnId(info.row.original, columns))?.label ?? 'Backlog',
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
        header: 'Due',
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
                className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[color:var(--text-2)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ),
      }),
    ],
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${colourClasses.dot}`} />
            <p className="os-eyebrow">Workstream</p>
          </div>
          <h1 className="os-page-title mt-2">{workstream.label}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} across {columns.length} columns
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-[color:var(--border)] bg-white p-1">
          {(['board', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-2xl px-4 py-2 text-sm capitalize transition ${
                viewMode === mode
                  ? 'bg-[var(--accent-dim)] text-[color:var(--accent-strong)] border border-[color:var(--accent)]'
                  : 'text-[color:var(--text-2)] hover:text-[color:var(--text)]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <ProjectsSection
        title="Projects"
        description="Delivery work currently running inside this workstream."
        projects={projects}
        emptyMessage="No projects linked to this workstream yet."
        actionHref={`/projects/new?workstream_id=${workstream.id}`}
        actionLabel="New project"
      />

      {viewMode === 'board' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnTasks = tasksByColumn[column.id] ?? []
              return (
                <div key={column.id} className="min-w-[20rem] max-w-[20rem] flex-1">
                  <DroppableColumn column={column}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--text)]">
                          {column.label}
                        </h2>
                        <p className="mt-1 text-xs text-[color:var(--text-2)]">{columnTasks.length} cards</p>
                      </div>
                    </div>

                    <SortableContext items={columnTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {columnTasks.map((task) => (
                          <SortableTask
                            key={task.id}
                            task={task}
                            columns={columns}
                            onSelect={setSelectedTask}
                          />
                        ))}
                      </div>
                    </SortableContext>

                    {columnTasks.length === 0 ? (
                      <div className="mt-3 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm text-[color:var(--text-2)]">
                        Drop a card here
                      </div>
                    ) : null}

                    <div className="mt-4">
                      {addingColumnId === column.id ? (
                        <QuickAddTask
                          workstreamId={workstream.id}
                          columnId={column.id}
                          placeholder={`Add a card to ${column.label}...`}
                          onCreated={(task) => {
                            setTasks((current) => [...current, task])
                            setAddingColumnId(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingColumnId(column.id)}
                          className="relative z-10 w-full rounded-2xl border border-dashed border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                        >
                          Add card
                        </button>
                      )}
                    </div>
                  </DroppableColumn>
                </div>
              )
            })}
          </div>
        </DndContext>
      ) : (
        <div className="overflow-x-auto os-card p-0">
          <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
            <thead className="bg-[var(--surface)] text-[10px] font-bold uppercase tracking-[1px] text-[color:var(--text-2)]">
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
        projects={projects}
        onSaved={(task) => {
          setTasks((current) => {
            const next = current.filter((entry) => entry.id !== task.id)
            if (task.workstream_id !== workstream.id) {
              return next
            }
            return [...next, task]
          })
          setSelectedTask(task)
        }}
        onDeleted={(taskId) => {
          setTasks((current) => current.filter((task) => task.id !== taskId))
          setSelectedTask(null)
        }}
      />
    </div>
  )
}
