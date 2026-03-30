'use client'

import { DragEvent, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { TaskWithWorkstream, Workstream } from '@/lib/types'
import TaskCard from './TaskCard'

const MASTER_COLUMN_ID = '__master__'

interface MasterTaskKanbanProps {
  tasks: TaskWithWorkstream[]
  workstreams: Workstream[]
  onSelectTask: (task: TaskWithWorkstream) => void
  onTaskSaved: (task: TaskWithWorkstream) => void
}

type KanbanColumn = {
  id: string
  label: string
  helper: string
}

function getColumnIdForTask(task: TaskWithWorkstream) {
  return task.workstream_id ?? MASTER_COLUMN_ID
}

export default function MasterTaskKanban({
  tasks,
  workstreams,
  onSelectTask,
  onTaskSaved,
}: MasterTaskKanbanProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState('')

  const workstreamsById = useMemo(
    () => new Map(workstreams.map((workstream) => [workstream.id, workstream])),
    [workstreams]
  )

  const columns = useMemo(() => {
    const workstreamIdsInView = new Set(
      tasks
        .map((task) => task.workstream_id)
        .filter((workstreamId): workstreamId is string => Boolean(workstreamId))
    )

    const nextColumns: KanbanColumn[] = []

    if (tasks.some((task) => !task.workstream_id)) {
      nextColumns.push({
        id: MASTER_COLUMN_ID,
        label: 'Master queue',
        helper: 'Tasks not currently assigned to a workstream',
      })
    }

    workstreams.forEach((workstream) => {
      if (!workstreamIdsInView.has(workstream.id)) {
        return
      }

      nextColumns.push({
        id: workstream.id,
        label: workstream.label,
        helper: 'Active tasks in this workstream',
      })
    })

    if (nextColumns.length === 0) {
      nextColumns.push({
        id: MASTER_COLUMN_ID,
        label: 'No tasks',
        helper: 'Try adjusting the filters to bring tasks into view',
      })
    }

    return nextColumns
  }, [tasks, workstreams])

  const tasksByColumn = useMemo(() => {
    const grouped = new Map<string, TaskWithWorkstream[]>()

    columns.forEach((column) => grouped.set(column.id, []))

    tasks.forEach((task) => {
      const columnId = getColumnIdForTask(task)
      if (!grouped.has(columnId)) {
        grouped.set(columnId, [])
      }
      grouped.get(columnId)?.push(task)
    })

    return grouped
  }, [columns, tasks])

  async function moveTask(taskId: string, destinationColumnId: string) {
    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) {
      return
    }

    const currentColumnId = getColumnIdForTask(task)
    if (currentColumnId === destinationColumnId) {
      return
    }

    const previousTask = task
    const destinationWorkstream =
      destinationColumnId === MASTER_COLUMN_ID
        ? null
        : workstreamsById.get(destinationColumnId) ?? null

    setMoveError('')
    setDraggedTaskId(taskId)

    onTaskSaved({
      ...task,
      workstream_id: destinationWorkstream?.id ?? null,
      workstream_label: destinationWorkstream?.label ?? null,
      workstream_slug: destinationWorkstream?.slug ?? null,
      workstream_colour: destinationWorkstream?.colour ?? null,
      column_id: destinationWorkstream ? task.column_id : null,
      is_master_todo: destinationWorkstream ? false : true,
    })

    try {
      const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/os/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          destinationWorkstream
            ? {
                workstream_id: destinationWorkstream.id,
                is_master_todo: false,
              }
            : {
                workstream_id: null,
                column_id: null,
                is_master_todo: true,
              }
        ),
      })

      onTaskSaved(response.task)
    } catch (error) {
      onTaskSaved(previousTask)
      setMoveError(
        error instanceof Error ? error.message : 'Failed to move task between columns'
      )
    } finally {
      setDraggedTaskId(null)
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, columnId: string) {
    event.preventDefault()

    const taskId = event.dataTransfer.getData('text/plain')
    if (!taskId) {
      return
    }

    void moveTask(taskId, columnId)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-slate-800 bg-slate-900/40 px-4 py-3">
        <p className="text-sm text-slate-400">
          Drag cards between columns to move tasks across workstreams.
        </p>
        {moveError ? (
          <p className="text-sm text-rose-300">{moveError}</p>
        ) : (
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Kanban view
          </p>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnTasks = tasksByColumn.get(column.id) ?? []

          return (
            <div
              key={column.id}
              onDrop={(event) => handleDrop(event, column.id)}
              onDragOver={handleDragOver}
              className="flex min-h-[28rem] w-[20rem] min-w-[20rem] flex-shrink-0 flex-col rounded-[2rem] border border-slate-800 bg-slate-900/70 p-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {column.label}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{column.helper}</p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
                  {columnTasks.length}
                </span>
              </div>

              <div className="mt-4 flex flex-1 flex-col gap-3">
                {columnTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/50 px-4 text-center text-sm text-slate-500">
                    Drop a task here
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', task.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggedTaskId(task.id)
                      }}
                      onDragEnd={() => setDraggedTaskId(null)}
                      className={`cursor-grab active:cursor-grabbing ${
                        draggedTaskId === task.id ? 'opacity-60' : ''
                      }`}
                    >
                      <TaskCard task={task} onClick={() => onSelectTask(task)} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
