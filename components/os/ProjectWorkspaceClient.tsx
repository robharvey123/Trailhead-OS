'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiFetch } from '@/lib/api-fetch'
import {
  formatTaskDate,
  getPriorityClasses,
  getTaskStatusClasses,
  getWorkstreamAccentHex,
} from '@/lib/os'
import { createClient } from '@/lib/supabase/client'
import type {
  ProjectDetail,
  ProjectMilestone,
  ProjectTaskStatus,
  TaskActivityEntry,
  TaskAttachment,
  TaskChecklistItem,
  TaskDependency,
  TaskPriority,
  TaskTimeLog,
  TaskWithWorkstream,
} from '@/lib/types'
import ProjectMilestonePanel from './ProjectMilestonePanel'
import PriorityBadge from './PriorityBadge'
import ProjectTaskPanel from './ProjectTaskPanel'
import QuickAddTask from './QuickAddTask'

type ProjectView = 'list' | 'gantt' | 'table'
type GanttZoom = 'day' | 'week' | 'month'

type SortKey =
  | 'title'
  | 'status'
  | 'priority'
  | 'owner'
  | 'start_date'
  | 'due_date'
  | 'estimated_hours'

type SortDirection = 'asc' | 'desc'

type EditableField =
  | 'title'
  | 'status'
  | 'priority'
  | 'owner'
  | 'start_date'
  | 'due_date'
  | 'estimated_hours'

type LaneItem =
  | { type: 'task'; task: TaskWithWorkstream }
  | { type: 'milestone'; milestone: ProjectMilestone }

const STATUS_COLUMNS: Array<{ id: ProjectTaskStatus; label: string }> = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
]

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
}

const ZOOM_CELL_CLASS: Record<GanttZoom, string> = {
  day: 'w-14',
  week: 'w-24',
  month: 'w-28',
}

function clampDepth(depth: number) {
  return Math.min(depth, 2)
}

function parseDate(value?: string | null) {
  if (!value) {
    return null
  }

  const next = new Date(`${value}T00:00:00`)
  return Number.isNaN(next.getTime()) ? null : next
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, amount: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + amount)
  return next
}

function addWeeks(value: Date, amount: number) {
  return addDays(value, amount * 7)
}

function addMonths(value: Date, amount: number) {
  const next = new Date(value)
  next.setMonth(next.getMonth() + amount)
  return next
}

function startOfWeek(value: Date) {
  const next = new Date(value)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function startOfUnit(value: Date, zoom: GanttZoom) {
  if (zoom === 'week') {
    return startOfWeek(value)
  }

  if (zoom === 'month') {
    return startOfMonth(value)
  }

  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function addUnits(value: Date, amount: number, zoom: GanttZoom) {
  if (zoom === 'week') {
    return addWeeks(value, amount)
  }

  if (zoom === 'month') {
    return addMonths(value, amount)
  }

  return addDays(value, amount)
}

function diffDays(left: Date, right: Date) {
  const milliseconds = right.getTime() - left.getTime()
  return Math.round(milliseconds / 86400000)
}

function diffUnits(left: Date, right: Date, zoom: GanttZoom) {
  if (zoom === 'month') {
    return (right.getFullYear() - left.getFullYear()) * 12 + (right.getMonth() - left.getMonth())
  }

  if (zoom === 'week') {
    return Math.round(diffDays(left, right) / 7)
  }

  return diffDays(left, right)
}

function formatHeaderDate(value: Date, zoom: GanttZoom) {
  if (zoom === 'month') {
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(value)
  }

  if (zoom === 'week') {
    const end = addDays(value, 6)
    return `${formatTaskDate(toDateString(value))} - ${formatTaskDate(toDateString(end))}`
  }

  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(value)
}

function getTaskStart(task: TaskWithWorkstream, fallback: Date) {
  return parseDate(task.start_date) ?? parseDate(task.due_date) ?? fallback
}

function getTaskEnd(task: TaskWithWorkstream, fallback: Date) {
  return parseDate(task.due_date) ?? parseDate(task.start_date) ?? fallback
}

function getOwnerInitials(owner?: string | null) {
  if (!owner) {
    return '??'
  }

  return owner
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('')
}

function getChecklistProgress(taskId: string, checklistItems: TaskChecklistItem[]) {
  const items = checklistItems.filter((item) => item.task_id === taskId)
  const complete = items.filter((item) => item.is_complete).length

  return {
    total: items.length,
    complete,
    percent: items.length > 0 ? Math.round((complete / items.length) * 100) : 0,
  }
}

function buildSubtaskMap(tasks: TaskWithWorkstream[]) {
  return tasks.reduce<Record<string, TaskWithWorkstream[]>>((accumulator, task) => {
    const parentId = task.parent_task_id
    if (!parentId) {
      return accumulator
    }

    if (!accumulator[parentId]) {
      accumulator[parentId] = []
    }

    accumulator[parentId].push(task)
    accumulator[parentId].sort((left, right) => left.order_index - right.order_index)
    return accumulator
  }, {})
}

function getSubtaskProgress(taskId: string, subtaskMap: Record<string, TaskWithWorkstream[]>) {
  const subtasks = subtaskMap[taskId] ?? []
  const complete = subtasks.filter((task) => task.status === 'done').length

  return {
    total: subtasks.length,
    complete,
    percent: subtasks.length > 0 ? Math.round((complete / subtasks.length) * 100) : 0,
  }
}

function buildNestedTasks(tasks: TaskWithWorkstream[]) {
  const subtaskMap = buildSubtaskMap(tasks)
  const rootTasks = tasks
    .filter((task) => !task.parent_task_id || !tasks.find((candidate) => candidate.id === task.parent_task_id))
    .sort((left, right) => left.order_index - right.order_index)

  const rows: Array<{ task: TaskWithWorkstream; depth: number }> = []

  function visit(task: TaskWithWorkstream, depth: number) {
    rows.push({ task, depth: clampDepth(depth) })
    for (const child of subtaskMap[task.id] ?? []) {
      visit(child, depth + 1)
    }
  }

  for (const task of rootTasks) {
    visit(task, 0)
  }

  return rows
}

function compareTasks(left: TaskWithWorkstream, right: TaskWithWorkstream, key: SortKey, direction: SortDirection) {
  const modifier = direction === 'asc' ? 1 : -1

  if (key === 'priority') {
    return (PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]) * modifier
  }

  if (key === 'estimated_hours') {
    return (((left.estimated_hours ?? 0) - (right.estimated_hours ?? 0)) || 0) * modifier
  }

  const leftValue = String(left[key] ?? '').toLowerCase()
  const rightValue = String(right[key] ?? '').toLowerCase()

  if (leftValue < rightValue) {
    return -1 * modifier
  }

  if (leftValue > rightValue) {
    return 1 * modifier
  }

  return 0
}

function taskMatchesSearch(task: TaskWithWorkstream, query: string) {
  const haystack = [
    task.title,
    task.description,
    task.owner,
    task.priority,
    task.status,
    task.tags.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function milestoneMatchesSearch(milestone: ProjectMilestone, query: string) {
  const haystack = [milestone.title, milestone.description, milestone.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function MilestoneBanner({ milestone }: { milestone: ProjectMilestone }) {
  const statusClasses =
    milestone.status === 'achieved'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
      : milestone.status === 'missed'
        ? 'border-red-500/30 bg-red-500/10 text-red-100'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-100'
  const icon = milestone.status === 'achieved' ? '[check]' : milestone.status === 'missed' ? '[warn]' : '[flag]'

  return (
    <div className={`rounded-2xl border px-3 py-3 text-xs ${statusClasses}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.18em]">
          <span aria-hidden="true">{icon}</span>
          <span>{milestone.title}</span>
        </div>
        <span>{formatTaskDate(milestone.due_date)}</span>
      </div>
      {milestone.description ? <p className="mt-2 text-[12px] text-sky-100/80">{milestone.description}</p> : null}
    </div>
  )
}

function ProgressBar({ percent, tone = 'bg-sky-400' }: { percent: number; tone?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full ${tone}`}
        style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
      />
    </div>
  )
}

function TaskStatusBadge({ status }: { status: ProjectTaskStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getTaskStatusClasses(status)}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function OwnerAvatar({ owner }: { owner?: string | null }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-[11px] font-semibold text-slate-200">
      {getOwnerInitials(owner)}
    </span>
  )
}

function SortableTaskCard({
  task,
  checklistItems,
  subtaskMap,
  disabled = false,
  onOpen,
}: {
  task: TaskWithWorkstream
  checklistItems: TaskChecklistItem[]
  subtaskMap: Record<string, TaskWithWorkstream[]>
  disabled?: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
    data: { type: 'task', taskId: task.id, status: task.status },
  })

  const checklist = getChecklistProgress(task.id, checklistItems)
  const subtasks = getSubtaskProgress(task.id, subtaskMap)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="touch-none"
    >
      <div
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className={`rounded-[1.6rem] border border-slate-800 bg-slate-950/90 p-4 text-left shadow-sm transition hover:border-slate-700 ${
          disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-slate-100">{task.title}</h3>
            <p className="mt-1 text-xs text-slate-400">{task.due_date ? formatTaskDate(task.due_date) : 'No due date'}</p>
          </div>
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OwnerAvatar owner={task.owner} />
            <span className="text-xs text-slate-400">{task.owner ?? 'Unassigned'}</span>
          </div>
          <TaskStatusBadge status={task.status} />
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-300">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>Subtasks</span>
              <span>{subtasks.complete}/{subtasks.total}</span>
            </div>
            <ProgressBar percent={subtasks.percent} tone="bg-blue-500" />
          </div>

          {checklist.total > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span>Checklist</span>
                <span>{checklist.percent}%</span>
              </div>
              <ProgressBar percent={checklist.percent} tone="bg-emerald-500" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DroppableStatusColumn({ status, children }: { status: ProjectTaskStatus; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: status, data: { type: 'status', status } })

  return (
    <div
      ref={setNodeRef}
      className={`rounded-[1.8rem] border p-4 transition ${
        isOver ? 'border-sky-500/60 bg-slate-900' : 'border-slate-800 bg-slate-900/70'
      }`}
    >
      {children}
    </div>
  )
}

function EditableTextCell({
  value,
  onSave,
  placeholder,
}: {
  value: string
  onSave: (nextValue: string) => Promise<void>
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  async function commit() {
    setEditing(false)
    if (draft !== value) {
      await onSave(draft)
    }
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="min-h-9 w-full text-left text-sm text-slate-100">
        {value || placeholder || 'Empty'}
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        }
      }}
      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
    />
  )
}

function EditableSelectCell<T extends string>({
  value,
  options,
  onSave,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onSave: (nextValue: T) => Promise<void>
}) {
  return (
    <select
      value={value}
      onChange={(event) => void onSave(event.target.value as T)}
      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

function EditableDateCell({ value, onSave }: { value: string | null; onSave: (nextValue: string | null) => Promise<void> }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(event) => void onSave(event.target.value || null)}
      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
    />
  )
}

function EditableNumberCell({ value, onSave }: { value: number | null; onSave: (nextValue: number | null) => Promise<void> }) {
  return (
    <input
      type="number"
      min="0"
      value={value ?? ''}
      onBlur={(event) => {
        const nextValue = event.target.value === '' ? null : Number(event.target.value)
        void onSave(Number.isFinite(nextValue) ? nextValue : null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          const target = event.target as HTMLInputElement
          const nextValue = target.value === '' ? null : Number(target.value)
          void onSave(Number.isFinite(nextValue) ? nextValue : null)
        }
      }}
      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
    />
  )
}

export default function ProjectWorkspaceClient({
  project,
  initialTaskId = null,
}: {
  project: ProjectDetail
  initialTaskId?: string | null
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [view, setView] = useState<ProjectView>('list')
  const [zoom, setZoom] = useState<GanttZoom>('week')
  const [tasks, setTasks] = useState(project.tasks)
  const [milestones, setMilestones] = useState(project.milestones)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectTaskStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [showSubtasks, setShowSubtasks] = useState(true)
  const [taskChecklists, setTaskChecklists] = useState(project.task_checklists)
  const [taskAttachments, setTaskAttachments] = useState(project.task_attachments)
  const [taskTimeLogs, setTaskTimeLogs] = useState(project.task_time_logs)
  const [taskActivity, setTaskActivity] = useState(project.task_activity)
  const [taskDependencies, setTaskDependencies] = useState(project.task_dependencies)
  const [taskStack, setTaskStack] = useState<string[]>(initialTaskId ? [initialTaskId] : [])
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [liveStatus, setLiveStatus] = useState<'live' | 'syncing' | 'offline'>('syncing')
  const [planningProject, setPlanningProject] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const accent = getWorkstreamAccentHex(project.workstream?.colour)
  const checklistItems = taskChecklists
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const ownerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          tasks
            .map((task) => task.owner?.trim())
            .filter((owner): owner is string => Boolean(owner))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [tasks]
  )
  const orderedMilestones = [...milestones].sort((left, right) => {
    if (left.order_index !== right.order_index) {
      return left.order_index - right.order_index
    }

    return left.due_date.localeCompare(right.due_date)
  })
  const subtaskMap = buildSubtaskMap(tasks)
  const filteredTasks = tasks.filter((task) => {
    if (task.status === 'cancelled') {
      return false
    }

    if (!showSubtasks && task.parent_task_id) {
      return false
    }

    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false
    }

    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false
    }

    if (ownerFilter !== 'all' && (task.owner ?? 'Unassigned') !== ownerFilter) {
      return false
    }

    if (normalizedSearch && !taskMatchesSearch(task, normalizedSearch)) {
      return false
    }

    return true
  })
  const visibleTasks = filteredTasks
  const filteredMilestones = orderedMilestones.filter(
    (milestone) => !normalizedSearch || milestoneMatchesSearch(milestone, normalizedSearch)
  )
  const hasActiveFilters =
    normalizedSearch.length > 0 ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    ownerFilter !== 'all' ||
    !showSubtasks
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === taskStack[taskStack.length - 1]) ?? null,
    [taskStack, tasks]
  )
  const selectedMilestone = useMemo(
    () => milestones.find((entry) => entry.id === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId]
  )

  useEffect(() => {
    if (!initialTaskId) {
      return
    }

    setTaskStack([initialTaskId])
  }, [initialTaskId])

  useEffect(() => {
    function handlePopState() {
      const match = window.location.pathname.match(/\/projects\/records\/[^/]+\/tasks\/([^/]+)$/)
      setTaskStack(match?.[1] ? [match[1]] : [])
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    let disposed = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    async function refreshProjectWorkspace() {
      try {
        const response = await apiFetch<{ project: ProjectDetail }>(`/api/projects/${project.id}`)
        if (disposed) {
          return
        }

        setTasks(response.project.tasks)
        setMilestones(response.project.milestones)
        setTaskChecklists(response.project.task_checklists)
        setTaskAttachments(response.project.task_attachments)
        setTaskTimeLogs(response.project.task_time_logs)
        setTaskActivity(response.project.task_activity)
        setTaskDependencies(response.project.task_dependencies)
        setSelectedIds((current) => current.filter((id) => response.project.tasks.some((task) => task.id === id)))
        setTaskStack((current) => current.filter((id) => response.project.tasks.some((task) => task.id === id)))
        setLiveStatus('live')
      } catch {
        if (!disposed) {
          setLiveStatus('offline')
        }
      }
    }

    function scheduleRefresh() {
      setLiveStatus('syncing')
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }

      refreshTimer = setTimeout(() => {
        void refreshProjectWorkspace()
      }, 250)
    }

    const channel = supabase
      .channel(`project-workspace-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${project.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_milestones', filter: `project_id=eq.${project.id}` }, scheduleRefresh)
      .subscribe((status) => {
        if (disposed) {
          return
        }

        if (status === 'SUBSCRIBED') {
          setLiveStatus('live')
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLiveStatus('offline')
        }
      })

    return () => {
      disposed = true
      if (refreshTimer) {
        clearTimeout(refreshTimer)
      }
      void supabase.removeChannel(channel)
    }
  }, [project.id, supabase])

  function syncTaskUrl(taskId: string | null) {
    const nextUrl = taskId
      ? `/projects/records/${project.id}/tasks/${taskId}`
      : `/projects/records/${project.id}`

    window.history.pushState({}, '', nextUrl)
  }

  function openTask(taskId: string, pushToStack = false) {
    setTaskStack((current) => {
      const nextStack = pushToStack && current.length > 0 ? [...current, taskId] : [taskId]
      return nextStack
    })
    syncTaskUrl(taskId)
  }

  function closeTaskPanel() {
    setTaskStack([])
    syncTaskUrl(null)
  }

  function openMilestone(milestoneId: string | null) {
    setSelectedMilestoneId(milestoneId)
  }

  function clearToolbarFilters() {
    setSearchQuery('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setOwnerFilter('all')
    setShowSubtasks(true)
  }

  async function runAiPlan() {
    if (planningProject || project.ai_planned) {
      return
    }

    setPlanningProject(true)
    setError(null)

    try {
      await apiFetch(`/api/projects/${project.id}/ai-plan`, {
        method: 'POST',
      })
      router.refresh()
    } catch (planningError) {
      setError(planningError instanceof Error ? planningError.message : 'Failed to AI plan project')
    } finally {
      setPlanningProject(false)
    }
  }

  function navigateBackInTaskStack() {
    setTaskStack((current) => {
      if (current.length <= 1) {
        syncTaskUrl(null)
        return []
      }

      const nextStack = current.slice(0, -1)
      syncTaskUrl(nextStack[nextStack.length - 1] ?? null)
      return nextStack
    })
  }

  function upsertTaskActivity(entries: TaskActivityEntry[]) {
    setTaskActivity((current) => {
      const byId = new Map(current.map((entry) => [entry.id, entry]))
      for (const entry of entries) {
        byId.set(entry.id, entry)
      }
      return Array.from(byId.values()).sort((left, right) => right.created_at.localeCompare(left.created_at))
    })
  }

  async function saveTaskPatch(taskId: string, patch: Record<string, unknown>) {
    setError(null)

    try {
      const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/os/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      setTasks((current) => current.map((task) => (task.id === taskId ? response.task : task)))
      if (response.task.status === 'done') {
        setTaskActivity((current) => current)
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update task')
    }
  }

  async function applyBulkPatch(patch: Record<string, unknown>) {
    await Promise.all(selectedIds.map((taskId) => saveTaskPatch(taskId, patch)))
  }

  async function deleteSelectedTasks() {
    setError(null)

    try {
      await Promise.all(
        selectedIds.map((taskId) =>
          apiFetch(`/api/os/tasks/${taskId}?hard=true`, {
            method: 'DELETE',
          })
        )
      )

      setTasks((current) => current.filter((task) => !selectedIds.includes(task.id)))
      setSelectedIds([])
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete tasks')
    }
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection('asc')
  }

  const tableTasks = [...visibleTasks].sort((left, right) => compareTasks(left, right, sortKey, sortDirection))
  const laneBaseCounts = STATUS_COLUMNS.reduce<Record<ProjectTaskStatus, number>>((accumulator, column) => {
    accumulator[column.id] = tasks.filter((task) => task.status === column.id && !task.parent_task_id).length
    return accumulator
  }, {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
    cancelled: 0,
  })

  const laneTasks = STATUS_COLUMNS.reduce<Record<ProjectTaskStatus, TaskWithWorkstream[]>>((accumulator, column) => {
    accumulator[column.id] = visibleTasks
      .filter((task) => task.status === column.id && !task.parent_task_id)
      .sort((left, right) => left.order_index - right.order_index)
    return accumulator
  }, {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
    cancelled: [],
  })

  async function persistLaneChanges(nextTasks: TaskWithWorkstream[], statuses: ProjectTaskStatus[]) {
    const updates = nextTasks
      .filter((task) => statuses.includes(task.status))
      .map((task) => ({
        id: task.id,
        sort_order: task.order_index,
        order_index: task.order_index,
        status: task.status,
      }))

    await apiFetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
  }

  async function handleLaneDragEnd(event: DragEndEvent) {
    if (hasActiveFilters) {
      return
    }

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
    const sourceStatus = activeTask.status
    const destinationStatus = STATUS_COLUMNS.some((column) => column.id === overId)
      ? (overId as ProjectTaskStatus)
      : overTask?.status ?? sourceStatus

    const nextTasks = tasks.map((task) => ({ ...task }))
    const sourceIds = nextTasks
      .filter((task) => task.status === sourceStatus && !task.parent_task_id)
      .sort((left, right) => left.order_index - right.order_index)
      .map((task) => task.id)

    const destinationIds = sourceStatus === destinationStatus
      ? [...sourceIds]
      : nextTasks
          .filter((task) => task.status === destinationStatus && !task.parent_task_id)
          .sort((left, right) => left.order_index - right.order_index)
          .map((task) => task.id)

    function setOrder(status: ProjectTaskStatus, taskIds: string[]) {
      taskIds.forEach((taskId, index) => {
        const task = nextTasks.find((candidate) => candidate.id === taskId)
        if (task) {
          task.status = status
          task.order_index = index
          task.sort_order = index
        }
      })
    }

    if (sourceStatus === destinationStatus) {
      const oldIndex = sourceIds.indexOf(activeId)
      const newIndex = overTask ? sourceIds.indexOf(overId) : sourceIds.length - 1
      const reordered = arrayMove(sourceIds, oldIndex, newIndex)
      setOrder(sourceStatus, reordered)
      setTasks(nextTasks)
      await persistLaneChanges(nextTasks, [sourceStatus])
      return
    }

    const nextSourceIds = sourceIds.filter((taskId) => taskId !== activeId)
    const insertIndex = overTask ? destinationIds.indexOf(overId) : destinationIds.length
    const nextDestinationIds = [...destinationIds]
    nextDestinationIds.splice(insertIndex, 0, activeId)
    setOrder(sourceStatus, nextSourceIds)
    setOrder(destinationStatus, nextDestinationIds)
    setTasks(nextTasks)
    await persistLaneChanges(nextTasks, [sourceStatus, destinationStatus])
  }

  const today = new Date()
  const fallbackDate = parseDate(project.start_date) ?? today
  const ganttRows = buildNestedTasks(visibleTasks)
  const timelineSourceDates = [
    ...visibleTasks.flatMap((task) => [parseDate(task.start_date), parseDate(task.due_date)]),
    ...filteredMilestones.map((milestone) => parseDate(milestone.due_date)),
  ].filter((value): value is Date => Boolean(value))

  const minTimelineDate = timelineSourceDates.length > 0 ? timelineSourceDates.sort((left, right) => left.getTime() - right.getTime())[0] : fallbackDate
  const maxTimelineDate = timelineSourceDates.length > 0 ? timelineSourceDates.sort((left, right) => left.getTime() - right.getTime())[timelineSourceDates.length - 1] : addDays(fallbackDate, 14)
  const rangeStart = startOfUnit(addUnits(minTimelineDate, -1, zoom), zoom)
  const rangeEnd = startOfUnit(addUnits(maxTimelineDate, 2, zoom), zoom)

  const units: Date[] = []
  let cursor = new Date(rangeStart)
  while (cursor <= rangeEnd) {
    units.push(new Date(cursor))
    cursor = addUnits(cursor, 1, zoom)
  }

  async function handleGanttDrop(task: TaskWithWorkstream, targetUnit: Date) {
    const taskStart = getTaskStart(task, fallbackDate)
    const taskEnd = getTaskEnd(task, taskStart)
    const delta = diffUnits(startOfUnit(taskStart, zoom), startOfUnit(targetUnit, zoom), zoom)
    const nextStart = addUnits(taskStart, delta, zoom)
    const nextEnd = addUnits(taskEnd, delta, zoom)
    await saveTaskPatch(task.id, { start_date: toDateString(nextStart), due_date: toDateString(nextEnd) })
  }

  function buildLaneItems(status: ProjectTaskStatus): LaneItem[] {
    const statusTasks = laneTasks[status]
    const sortedMilestones = filteredMilestones
    const items: LaneItem[] = []
    let taskIndex = 0

    for (const milestone of sortedMilestones) {
      while (taskIndex < statusTasks.length) {
        const task = statusTasks[taskIndex]
        const taskDue = task.due_date ?? '9999-12-31'
        if (taskDue >= milestone.due_date) {
          break
        }
        items.push({ type: 'task', task })
        taskIndex += 1
      }
      items.push({ type: 'milestone', milestone })
    }

    while (taskIndex < statusTasks.length) {
      items.push({ type: 'task', task: statusTasks[taskIndex] })
      taskIndex += 1
    }

    return items
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,146,60,0.14),transparent_24%),rgba(15,23,42,0.84)] p-6 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: accent }} />
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Project workspace</p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-50">{project.title || project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{project.description || project.brief || 'No summary added yet.'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {project.ai_planned ? (
                  <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                    AI planned
                  </span>
                ) : null}
                {!project.ai_planned && project.brief ? (
                  <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                    Ready for AI planning
                  </span>
                ) : null}
                {!project.ai_planned && !project.brief ? (
                  <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                    Add a brief to use AI planning
                  </span>
                ) : null}
              </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {!project.ai_planned ? (
              <button
                type="button"
                onClick={() => void runAiPlan()}
                disabled={planningProject || !project.brief}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {planningProject ? 'Running AI plan...' : 'Run AI plan'}
              </button>
            ) : null}
            <Link
              href={`/projects/records/${project.id}/edit`}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Edit project
            </Link>

            <div className="inline-flex rounded-2xl border border-white/10 bg-slate-950/80 p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              {(['list', 'gantt', 'table'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-2xl px-4 py-2 text-sm capitalize transition ${
                    view === mode ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Toolbar</p>
              <p className="mt-1 text-sm text-slate-400">Search, filter, and add work without leaving the project workspace.</p>
              <div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 ${
                    liveStatus === 'live'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                      : liveStatus === 'syncing'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                  }`}
                >
                  {liveStatus === 'live' ? 'Live updates on' : liveStatus === 'syncing' ? 'Syncing updates' : 'Live updates offline'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openMilestone('__new__')}
                className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Add Milestone
              </button>
              <button
                type="button"
                onClick={clearToolbarFilters}
                disabled={!hasActiveFilters}
                className="rounded-2xl border border-slate-800 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))]">
            <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Search
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, owner, notes, tags"
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-slate-100 placeholder:text-slate-500"
              />
            </label>

            <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ProjectTaskStatus)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-slate-100"
              >
                <option value="all">All statuses</option>
                {STATUS_COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Priority
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as 'all' | TaskPriority)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-slate-100"
              >
                <option value="all">All priorities</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Owner
              <select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm normal-case tracking-normal text-slate-100"
              >
                <option value="all">All owners</option>
                <option value="Unassigned">Unassigned</option>
                {ownerOptions.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
              <span>Show subtasks</span>
              <input
                type="checkbox"
                checked={showSubtasks}
                onChange={(event) => setShowSubtasks(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-400"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_auto]">
            <QuickAddTask
              workstream_id={project.workstream_id}
              project_id={project.id}
              status="todo"
              order_index={laneBaseCounts.todo}
              placeholder="Add a new project task"
              buttonLabel="Add Task"
              onCreated={(task) => setTasks((current) => [...current, task])}
            />

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-center text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Visible</p>
                <p className="mt-1 font-semibold text-slate-100">{visibleTasks.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open</p>
                <p className="mt-1 font-semibold text-slate-100">{visibleTasks.filter((task) => task.status !== 'done').length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Milestones</p>
                <p className="mt-1 font-semibold text-slate-100">{filteredMilestones.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Owner</p>
            <p className="mt-2 text-sm text-slate-100">{project.owner ?? 'Unassigned'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Timeline</p>
            <p className="mt-2 text-sm text-slate-100">{project.start_date ? formatTaskDate(project.start_date) : 'No start'} to {project.end_date ? formatTaskDate(project.end_date) : 'No end'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tasks</p>
            <p className="mt-2 text-sm text-slate-100">{visibleTasks.length} visible / {tasks.length} total</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Milestones</p>
            <p className="mt-2 text-sm text-slate-100">{filteredMilestones.length} visible / {orderedMilestones.length} tracked</p>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </section>

      {view === 'list' ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void handleLaneDragEnd(event)}>
          <div className="space-y-4">
            {hasActiveFilters ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Drag and drop is paused while filters are active so lane ordering stays stable.
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-4">
            {STATUS_COLUMNS.map((column) => {
              const laneItems = buildLaneItems(column.id)
              const laneTaskIds = laneTasks[column.id].map((task) => task.id)

              return (
                <DroppableStatusColumn key={column.id} status={column.id}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{column.label}</h2>
                      <p className="mt-1 text-xs text-slate-500">{laneTasks[column.id].length} tasks</p>
                    </div>
                    <TaskStatusBadge status={column.id} />
                  </div>

                  <SortableContext items={laneTaskIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {laneItems.map((item) =>
                        item.type === 'milestone' ? (
                          <button
                            key={`milestone-${column.id}-${item.milestone.id}`}
                            type="button"
                            onClick={() => openMilestone(item.milestone.id)}
                            className="block w-full text-left"
                          >
                            <MilestoneBanner milestone={item.milestone} />
                          </button>
                        ) : (
                          <SortableTaskCard
                            key={item.task.id}
                            task={item.task}
                            checklistItems={checklistItems}
                            subtaskMap={subtaskMap}
                            disabled={hasActiveFilters}
                            onOpen={() => openTask(item.task.id)}
                          />
                        )
                      )}
                    </div>
                  </SortableContext>

                  <div className="mt-4">
                    <QuickAddTask
                      workstream_id={project.workstream_id}
                      project_id={project.id}
                      status={column.id}
                      order_index={laneBaseCounts[column.id]}
                      placeholder={`Add task to ${column.label.toLowerCase()}...`}
                      onCreated={(task) => setTasks((current) => [...current, task])}
                    />
                  </div>
                </DroppableStatusColumn>
              )
            })}
            </div>
          </div>
        </DndContext>
      ) : null}

      {view === 'gantt' ? (
        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.72))] p-6 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Timeline</h2>
              <p className="mt-1 text-sm text-slate-400">Drag a task bar horizontally to reschedule it.</p>
            </div>
            <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setZoom(mode)}
                  className={`rounded-2xl px-4 py-2 text-sm capitalize transition ${
                    zoom === mode ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-max space-y-3">
              <div className="flex items-stretch gap-3">
                <div className="sticky left-0 z-10 flex w-80 items-end bg-slate-900/70 pb-2 pr-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  Tasks and milestones
                </div>
                <div className="flex gap-1">
                  {units.map((unit) => (
                    <div key={unit.toISOString()} className={`${ZOOM_CELL_CLASS[zoom]} rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-2 text-center text-[11px] text-slate-300`}>
                      {formatHeaderDate(unit, zoom)}
                    </div>
                  ))}
                </div>
              </div>

              {filteredMilestones.length > 0 ? (
                <div className="flex items-stretch gap-3">
                  <div className="sticky left-0 z-10 flex w-80 items-center rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm font-medium text-slate-100">
                    Milestones
                  </div>
                  <div className="flex gap-1">
                    {units.map((unit) => {
                      const unitEnd = addUnits(unit, 1, zoom)
                      const milestoneInCell = filteredMilestones.filter((milestone) => {
                        const due = parseDate(milestone.due_date)
                        return due ? due >= unit && due < unitEnd : false
                      })

                      return (
                        <div key={`milestones-${unit.toISOString()}`} className={`${ZOOM_CELL_CLASS[zoom]} flex min-h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70`}>
                          {milestoneInCell.map((milestone) => (
                            <button
                              key={milestone.id}
                              type="button"
                              onClick={() => openMilestone(milestone.id)}
                              className="mx-1 flex max-w-full flex-col items-center gap-1 overflow-hidden text-[10px] text-slate-200"
                              title={milestone.title}
                            >
                              <span className="block h-3 w-3 rotate-45 rounded-sm border border-white/20" style={{ backgroundColor: milestone.colour }} />
                              <span className="max-w-full truncate">{milestone.title}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {ganttRows.map(({ task, depth }) => {
                const taskStart = getTaskStart(task, fallbackDate)
                const taskEnd = getTaskEnd(task, taskStart)
                const startIndex = Math.max(0, diffUnits(rangeStart, startOfUnit(taskStart, zoom), zoom))
                const endIndex = Math.max(startIndex, diffUnits(rangeStart, startOfUnit(taskEnd, zoom), zoom))
                const isSubtask = depth > 0

                return (
                  <div key={task.id} className="flex items-stretch gap-3">
                    <div className="sticky left-0 z-10 flex w-80 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-100">
                      <div className={`h-2 w-2 rounded-full ${task.status === 'blocked' ? 'bg-red-400' : task.status === 'done' ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                      <div className={`min-w-0 flex-1 overflow-hidden ${depth === 1 ? 'pl-4' : depth >= 2 ? 'pl-8' : ''}`}>
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          className={`block w-full truncate text-left font-medium ${isSubtask ? 'text-slate-300' : 'text-slate-100'}`}
                          title={task.title}
                        >
                          {task.title}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{task.owner ?? 'Unassigned'}</p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      {units.map((unit, unitIndex) => {
                        const unitEnd = addUnits(unit, 1, zoom)
                        const isToday = today >= unit && today < unitEnd
                        const isOccupied = unitIndex >= startIndex && unitIndex <= endIndex
                        const isBarStart = unitIndex === startIndex
                        const isBarEnd = unitIndex === endIndex

                        return (
                          <div
                            key={`${task.id}-${unit.toISOString()}`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault()
                              if (event.dataTransfer.getData('text/task-id') === task.id) {
                                void handleGanttDrop(task, unit)
                              }
                            }}
                            className={`${ZOOM_CELL_CLASS[zoom]} flex min-h-12 items-center border border-slate-800 bg-slate-950/70 ${isToday ? 'border-l-red-500' : ''}`}
                          >
                            {isOccupied ? (
                              <div
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData('text/task-id', task.id)}
                                className={`flex h-${isSubtask ? '6' : '8'} w-full items-center px-1 ${
                                  task.priority === 'critical'
                                    ? 'bg-red-500/80'
                                    : task.priority === 'high'
                                      ? 'bg-orange-400/80'
                                      : task.priority === 'medium'
                                        ? 'bg-amber-300/80 text-slate-950'
                                        : 'bg-slate-400/80 text-slate-950'
                                } ${isBarStart ? 'rounded-l-lg' : ''} ${isBarEnd ? 'rounded-r-lg' : ''}`}
                              />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {view === 'table' ? (
        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.68))] p-6 backdrop-blur">
          {selectedIds.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
              <span className="text-sm text-sky-100">{selectedIds.length} selected</span>
              <button type="button" onClick={() => void applyBulkPatch({ status: 'done' })} className="rounded-xl border border-sky-300/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-50">
                Mark done
              </button>
              <button type="button" onClick={() => void applyBulkPatch({ priority: 'high' })} className="rounded-xl border border-sky-300/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-50">
                Set high
              </button>
              <button type="button" onClick={() => void deleteSelectedTasks()} className="rounded-xl border border-red-300/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                Delete
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === tableTasks.length}
                      onChange={(event) => setSelectedIds(event.target.checked ? tableTasks.map((task) => task.id) : [])}
                    />
                  </th>
                  {[
                    ['title', 'Title'],
                    ['status', 'Status'],
                    ['priority', 'Priority'],
                    ['owner', 'Owner'],
                    ['start_date', 'Start Date'],
                    ['due_date', 'Due Date'],
                    ['estimated_hours', 'Est. Hours'],
                  ].map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-left">
                      <button type="button" onClick={() => toggleSort(key as SortKey)} className="inline-flex items-center gap-2">
                        {label}
                        {sortKey === key ? (sortDirection === 'asc' ? '^' : 'v') : '<>'}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {tableTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(task.id)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, task.id]
                              : current.filter((value) => value !== task.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-2">
                        <EditableTextCell value={task.title} onSave={(nextValue) => saveTaskPatch(task.id, { title: nextValue })} />
                        <button type="button" onClick={() => openTask(task.id)} className="text-xs text-sky-300 hover:text-sky-200">
                          Open panel
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableSelectCell
                        value={task.status}
                        options={STATUS_COLUMNS.map((column) => ({ value: column.id, label: column.label }))}
                        onSave={(nextValue) => saveTaskPatch(task.id, { status: nextValue })}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableSelectCell
                        value={task.priority}
                        options={[
                          { value: 'critical', label: 'Critical' },
                          { value: 'high', label: 'High' },
                          { value: 'medium', label: 'Medium' },
                          { value: 'low', label: 'Low' },
                          { value: 'urgent', label: 'Urgent' },
                        ]}
                        onSave={(nextValue) => saveTaskPatch(task.id, { priority: nextValue })}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableTextCell value={task.owner ?? ''} placeholder="Unassigned" onSave={(nextValue) => saveTaskPatch(task.id, { owner: nextValue || null })} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableDateCell value={task.start_date} onSave={(nextValue) => saveTaskPatch(task.id, { start_date: nextValue })} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableDateCell value={task.due_date} onSave={(nextValue) => saveTaskPatch(task.id, { due_date: nextValue })} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <EditableNumberCell value={task.estimated_hours} onSave={(nextValue) => saveTaskPatch(task.id, { estimated_hours: nextValue })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <ProjectTaskPanel
        open={Boolean(selectedTask)}
        projectId={project.id}
        task={selectedTask}
        tasks={tasks}
        checklistItems={taskChecklists}
        attachments={taskAttachments}
        timeLogs={taskTimeLogs}
        activity={taskActivity}
        dependencies={taskDependencies}
        taskStack={taskStack}
        onClose={closeTaskPanel}
        onBack={navigateBackInTaskStack}
        onOpenTask={(taskId) => openTask(taskId, true)}
        onTaskSaved={(task) => setTasks((current) => current.map((entry) => (entry.id === task.id ? task : entry)))}
        onTaskCreated={(task) => setTasks((current) => [...current, task])}
        onTaskDeleted={(taskId) => {
          setTasks((current) => current.filter((task) => task.id !== taskId))
          setTaskStack((current) => current.filter((value) => value !== taskId))
          syncTaskUrl(null)
        }}
        onChecklistChange={setTaskChecklists}
        onAttachmentsChange={setTaskAttachments}
        onTimeLogsChange={setTaskTimeLogs}
        onActivityChange={upsertTaskActivity}
        onDependenciesChange={setTaskDependencies}
      />

      <ProjectMilestonePanel
        open={selectedMilestoneId !== null}
        projectId={project.id}
        milestone={selectedMilestoneId === '__new__' ? null : selectedMilestone}
        tasks={tasks}
        onClose={() => openMilestone(null)}
        onSaved={(milestone) =>
          setMilestones((current) => current.map((entry) => (entry.id === milestone.id ? milestone : entry)))
        }
        onCreated={(milestone) => setMilestones((current) => [...current, milestone])}
      />
    </div>
  )
}