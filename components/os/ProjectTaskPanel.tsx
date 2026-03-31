'use client'

import { useEffect, useMemo, useState } from 'react'
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiFetch } from '@/lib/api-fetch'
import { formatDateTime, formatTaskDate, getTaskStatusClasses } from '@/lib/os'
import { createClient } from '@/lib/supabase/client'
import type {
  TaskActivityEntry,
  TaskAttachment,
  TaskChecklistItem,
  TaskDependency,
  TaskPriority,
  TaskTimeLog,
  TaskWithWorkstream,
} from '@/lib/types'
import PriorityBadge from './PriorityBadge'

type PanelTab = 'overview' | 'subtasks' | 'checklist' | 'attachments' | 'time-log' | 'activity'

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

function SortableChecklistRow({
  item,
  onToggle,
  onTitleChange,
  onDelete,
}: {
  item: TaskChecklistItem
  onToggle: () => void
  onTitleChange: (value: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-slate-500 active:cursor-grabbing">
        ::
      </button>
      <input type="checkbox" checked={item.is_complete} onChange={onToggle} />
      <input
        value={item.title}
        onChange={(event) => onTitleChange(event.target.value)}
        className="flex-1 bg-transparent text-sm text-slate-100 outline-none"
      />
      <button type="button" onClick={onDelete} className="text-xs text-rose-300">
        Delete
      </button>
    </div>
  )
}

function SortableSubtaskRow({
  task,
  onToggle,
  onOpen,
}: {
  task: TaskWithWorkstream
  onToggle: () => void
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3"
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-slate-500 active:cursor-grabbing">
        ::
      </button>
      <input type="checkbox" checked={task.status === 'done'} onChange={onToggle} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
        <p className="mt-1 text-xs text-slate-500">{task.owner ?? 'Unassigned'} {task.due_date ? `· ${formatTaskDate(task.due_date)}` : ''}</p>
      </button>
      <PriorityBadge priority={task.priority} />
      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${getTaskStatusClasses(task.status)}`}>
        {task.status.replace('_', ' ')}
      </span>
    </div>
  )
}

export default function ProjectTaskPanel({
  open,
  projectId,
  task,
  tasks,
  checklistItems,
  attachments,
  timeLogs,
  activity,
  dependencies,
  taskStack,
  onClose,
  onBack,
  onOpenTask,
  onTaskSaved,
  onTaskCreated,
  onTaskDeleted,
  onChecklistChange,
  onAttachmentsChange,
  onTimeLogsChange,
  onActivityChange,
  onDependenciesChange,
}: {
  open: boolean
  projectId: string
  task: TaskWithWorkstream | null
  tasks: TaskWithWorkstream[]
  checklistItems: TaskChecklistItem[]
  attachments: TaskAttachment[]
  timeLogs: TaskTimeLog[]
  activity: TaskActivityEntry[]
  dependencies: TaskDependency[]
  taskStack: string[]
  onClose: () => void
  onBack: () => void
  onOpenTask: (taskId: string) => void
  onTaskSaved: (task: TaskWithWorkstream) => void
  onTaskCreated: (task: TaskWithWorkstream) => void
  onTaskDeleted: (taskId: string) => void
  onChecklistChange: (items: TaskChecklistItem[]) => void
  onAttachmentsChange: (items: TaskAttachment[]) => void
  onTimeLogsChange: (items: TaskTimeLog[]) => void
  onActivityChange: (items: TaskActivityEntry[]) => void
  onDependenciesChange: (items: TaskDependency[]) => void
}) {
  const [supabase] = useState(() => createClient())
  const [activeTab, setActiveTab] = useState<PanelTab>('overview')
  const [currentUserLabel, setCurrentUserLabel] = useState<string | null>(null)
  const [dependencySearch, setDependencySearch] = useState('')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [timeDraft, setTimeDraft] = useState({ description: '', hours: '', logged_date: new Date().toISOString().slice(0, 10) })
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setCurrentUserLabel(user?.email ?? user?.id ?? null)
    }

    void loadCurrentUser()
  }, [supabase])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, open])

  useEffect(() => {
    setActiveTab('overview')
    setError(null)
    setDependencySearch('')
    setNewSubtaskTitle('')
    setNewChecklistTitle('')
    setCommentDraft('')
    setTimeDraft({ description: '', hours: '', logged_date: new Date().toISOString().slice(0, 10) })
  }, [task?.id])

  const currentTask = task
  const currentChecklistItems = currentTask ? checklistItems.filter((item) => item.task_id === currentTask.id).sort((left, right) => left.order_index - right.order_index) : []
  const currentAttachments = currentTask ? attachments.filter((item) => item.task_id === currentTask.id) : []
  const currentTimeLogs = currentTask ? timeLogs.filter((item) => item.task_id === currentTask.id).sort((left, right) => right.logged_date.localeCompare(left.logged_date)) : []
  const currentActivity = currentTask ? activity.filter((item) => item.task_id === currentTask.id).sort((left, right) => right.created_at.localeCompare(left.created_at)) : []
  const currentDependencies = currentTask ? dependencies.filter((item) => item.task_id === currentTask.id) : []
  const childTasks = currentTask ? tasks.filter((entry) => entry.parent_task_id === currentTask.id).sort((left, right) => left.order_index - right.order_index) : []
  const nestedChildTasks = currentTask
    ? childTasks.flatMap((child) => [child, ...tasks.filter((entry) => entry.parent_task_id === child.id).sort((left, right) => left.order_index - right.order_index)])
    : []
  const parentTask = currentTask?.parent_task_id ? tasks.find((entry) => entry.id === currentTask.parent_task_id) ?? null : null
  const availableDependencyTasks = currentTask
    ? tasks.filter(
        (entry) =>
          entry.id !== currentTask.id &&
          entry.project_id === projectId &&
          entry.title.toLowerCase().includes(dependencySearch.toLowerCase())
      )
    : []
  const checklistComplete = currentChecklistItems.filter((item) => item.is_complete).length
  const checklistAllDone = currentChecklistItems.length > 0 && checklistComplete === currentChecklistItems.length
  const timeLogged = currentTimeLogs.reduce((sum, entry) => sum + entry.hours, 0)
  const estimated = currentTask?.estimated_hours ?? 0
  const breadcrumbTasks = taskStack.map((taskId) => tasks.find((entry) => entry.id === taskId)).filter((value): value is TaskWithWorkstream => Boolean(value))

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (!open || !currentTask) {
    return null
  }

  const activeTask = currentTask

  async function saveTaskPatch(patch: Record<string, unknown>) {
    setError(null)

    try {
      const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/os/tasks/${activeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onTaskSaved(response.task)

      const { data: latestActivity, error: activityError } = await supabase
        .from('task_activity')
        .select('*')
        .eq('task_id', activeTask.id)
        .order('created_at', { ascending: false })

      if (!activityError) {
        onActivityChange((latestActivity ?? []) as TaskActivityEntry[])
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update task')
    }
  }

  async function deleteTask() {
    setError(null)
    try {
      await apiFetch(`/api/os/tasks/${activeTask.id}?hard=true`, { method: 'DELETE' })
      onTaskDeleted(activeTask.id)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete task')
    }
  }

  async function addDependency(type: 'blocks' | 'blocked_by', dependsOnTaskId: string) {
    const { data, error: insertError } = await supabase
      .from('task_dependencies')
      .insert({ task_id: activeTask.id, depends_on_task_id: dependsOnTaskId, type })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    onDependenciesChange([...dependencies, data as TaskDependency])
  }

  async function removeDependency(id: string) {
    const { error: deleteError } = await supabase.from('task_dependencies').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onDependenciesChange(dependencies.filter((item) => item.id !== id))
  }

  async function createSubtask() {
    const title = newSubtaskTitle.trim()
    if (!title) {
      return
    }

    try {
      const response = await apiFetch<{ task: TaskWithWorkstream }>('/api/os/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          project_id: projectId,
          workstream_id: activeTask.workstream_id,
          parent_task_id: activeTask.id,
          status: 'todo',
          order_index: childTasks.length,
          sort_order: childTasks.length,
        }),
      })

      onTaskCreated(response.task)
      setNewSubtaskTitle('')
      onOpenTask(response.task.id)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create subtask')
    }
  }

  async function handleSubtaskDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) {
      return
    }

    const ids = childTasks.map((entry) => entry.id)
    const reordered = arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId))
    try {
      await apiFetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: reordered.map((id, index) => ({ id, sort_order: index, order_index: index, status: childTasks.find((entry) => entry.id === id)?.status })),
        }),
      })

      reordered.forEach((id, index) => {
        const entry = tasks.find((taskEntry) => taskEntry.id === id)
        if (entry) {
          onTaskSaved({ ...entry, order_index: index, sort_order: index })
        }
      })
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : 'Failed to reorder subtasks')
    }
  }

  async function addChecklistItem() {
    const title = newChecklistTitle.trim()
    if (!title) {
      return
    }

    const { data, error: insertError } = await supabase
      .from('task_checklists')
      .insert({ task_id: activeTask.id, title, order_index: currentChecklistItems.length })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    onChecklistChange([...checklistItems, data as TaskChecklistItem])
    setNewChecklistTitle('')
  }

  async function updateChecklistItem(id: string, patch: Partial<TaskChecklistItem>) {
    const { data, error: updateError } = await supabase.from('task_checklists').update(patch).eq('id', id).select('*').single()
    if (updateError) {
      setError(updateError.message)
      return
    }

    onChecklistChange(checklistItems.map((item) => (item.id === id ? (data as TaskChecklistItem) : item)))
  }

  async function deleteChecklistItem(id: string) {
    const { error: deleteError } = await supabase.from('task_checklists').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onChecklistChange(checklistItems.filter((item) => item.id !== id))
  }

  async function handleChecklistDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id)
    const overId = event.over ? String(event.over.id) : null
    if (!overId) {
      return
    }

    const ids = currentChecklistItems.map((entry) => entry.id)
    const reordered = arrayMove(ids, ids.indexOf(activeId), ids.indexOf(overId))
    const nextItems = currentChecklistItems.map((entry) => ({ ...entry }))

    await Promise.all(
      reordered.map(async (id, index) => {
        const { data, error: updateError } = await supabase
          .from('task_checklists')
          .update({ order_index: index })
          .eq('id', id)
          .select('*')
          .single()
        if (updateError) {
          throw updateError
        }

        const itemIndex = nextItems.findIndex((entry) => entry.id === id)
        if (itemIndex >= 0) {
          nextItems[itemIndex] = data as TaskChecklistItem
        }
      })
    ).catch((dragError) => {
      setError(dragError instanceof Error ? dragError.message : 'Failed to reorder checklist')
    })

    onChecklistChange([...checklistItems.filter((item) => item.task_id !== activeTask.id), ...nextItems])
  }

  async function ensureAttachmentBucket() {
    const { data } = await supabase.storage.listBuckets()
    if ((data ?? []).some((bucket) => bucket.name === 'task-attachments')) {
      return
    }

    await supabase.storage.createBucket('task-attachments', { public: false })
  }

  async function handleAttachmentUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploading(true)
    setError(null)

    try {
      await ensureAttachmentBucket()
      const path = `${projectId}/${activeTask.id}/${Date.now()}-${file.name}`
      const upload = await supabase.storage.from('task-attachments').upload(path, file)
      if (upload.error) {
        throw upload.error
      }

      const { data, error: insertError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: activeTask.id,
          filename: file.name,
          storage_path: path,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: currentUserLabel,
        })
        .select('*')
        .single()

      if (insertError) {
        throw insertError
      }

      onAttachmentsChange([data as TaskAttachment, ...attachments])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload attachment')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function openAttachment(item: TaskAttachment) {
    const signed = await supabase.storage.from('task-attachments').createSignedUrl(item.storage_path, 3600)
    if (signed.error || !signed.data?.signedUrl) {
      setError(signed.error?.message ?? 'Failed to open attachment')
      return
    }

    if (item.mime_type?.startsWith('image/')) {
      setPreviewUrl(signed.data.signedUrl)
      return
    }

    window.open(signed.data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteAttachment(id: string, storagePath: string) {
    const storageDelete = await supabase.storage.from('task-attachments').remove([storagePath])
    if (storageDelete.error) {
      setError(storageDelete.error.message)
      return
    }

    const { error: deleteError } = await supabase.from('task_attachments').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onAttachmentsChange(attachments.filter((item) => item.id !== id))
  }

  async function addTimeLog() {
    const hours = Number(timeDraft.hours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setError('Hours must be greater than 0')
      return
    }

    const { data, error: insertError } = await supabase
      .from('task_time_logs')
      .insert({
        task_id: activeTask.id,
        description: timeDraft.description.trim() || null,
        hours,
        logged_date: timeDraft.logged_date,
        logged_by: currentUserLabel,
      })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    onTimeLogsChange([data as TaskTimeLog, ...timeLogs])
    setTimeDraft({ description: '', hours: '', logged_date: new Date().toISOString().slice(0, 10) })
  }

  async function deleteTimeLog(id: string) {
    const { error: deleteError } = await supabase.from('task_time_logs').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onTimeLogsChange(timeLogs.filter((item) => item.id !== id))
  }

  async function addComment() {
    const content = commentDraft.trim()
    if (!content) {
      return
    }

    const { data, error: insertError } = await supabase
      .from('task_activity')
      .insert({ task_id: activeTask.id, type: 'comment', content, created_by: currentUserLabel })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    onActivityChange([data as TaskActivityEntry])
    setCommentDraft('')
  }

  async function updateComment(id: string, content: string) {
    const { data, error: updateError } = await supabase
      .from('task_activity')
      .update({ content })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    onActivityChange([data as TaskActivityEntry])
  }

  async function deleteComment(id: string) {
    const { error: deleteError } = await supabase.from('task_activity').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onActivityChange(activity.filter((item) => item.id !== id))
  }

  async function toggleSubtask(entry: TaskWithWorkstream) {
    try {
      const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/os/tasks/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: entry.status === 'done' ? 'todo' : 'done' }),
      })
      onTaskSaved(response.task)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update subtask')
    }
  }

  const dependencyTaskMap = new Map(tasks.map((entry) => [entry.id, entry]))

  const tabs: Array<{ id: PanelTab; label: string; accent?: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'subtasks', label: `Subtasks ${childTasks.filter((entry) => entry.status === 'done').length}/${childTasks.length}` },
    { id: 'checklist', label: `Checklist ${checklistComplete}/${currentChecklistItems.length}`, accent: checklistAllDone ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' : undefined },
    { id: 'attachments', label: `Attachments ${currentAttachments.length}` },
    { id: 'time-log', label: 'Time Log' },
    { id: 'activity', label: `Activity ${currentActivity.length}` },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[560px] translate-x-0 overflow-y-auto border-l border-white/10 bg-slate-950 shadow-2xl transition-transform duration-300">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92))] px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                {taskStack.length > 1 ? (
                  <button type="button" onClick={onBack} className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">
                    Back
                  </button>
                ) : null}
                {breadcrumbTasks.map((entry, index) => (
                  <span key={entry.id} className="truncate">
                    {index > 0 ? ' > ' : ''}
                    {entry.title}
                  </span>
                ))}
              </div>

              <input
                value={currentTask.title}
                onChange={(event) => onTaskSaved({ ...currentTask, title: event.target.value })}
                onBlur={(event) => void saveTaskPatch({ title: event.target.value })}
                className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none dark:text-slate-100"
              />
              {parentTask ? (
                <button type="button" onClick={() => onOpenTask(parentTask.id)} className="mt-2 text-sm text-sky-300 hover:text-sky-200">
                  Parent: {parentTask.title}
                </button>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getTaskStatusClasses(currentTask.status)}`}>
              {currentTask.status.replace('_', ' ')}
            </span>
            <PriorityBadge priority={currentTask.priority} />
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              {timeLogged.toFixed(1)}h logged
            </span>
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              {estimated.toFixed(1)}h estimated
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Status</span>
              <select
                value={currentTask.status}
                onChange={(event) => void saveTaskPatch({ status: event.target.value })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Priority</span>
              <select
                value={currentTask.priority}
                onChange={(event) => void saveTaskPatch({ priority: event.target.value })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Owner</span>
              <input
                defaultValue={currentTask.owner ?? ''}
                onBlur={(event) => void saveTaskPatch({ owner: event.target.value.trim() || null })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Start date</span>
              <input
                type="date"
                value={currentTask.start_date ?? ''}
                onChange={(event) => onTaskSaved({ ...currentTask, start_date: event.target.value || null })}
                onBlur={(event) => void saveTaskPatch({ start_date: event.target.value || null })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Due date</span>
              <input
                type="date"
                value={currentTask.due_date ?? ''}
                onChange={(event) => onTaskSaved({ ...currentTask, due_date: event.target.value || null })}
                onBlur={(event) => void saveTaskPatch({ due_date: event.target.value || null })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Estimated hours</span>
              <input
                type="number"
                min="0"
                defaultValue={currentTask.estimated_hours ?? ''}
                onBlur={(event) => void saveTaskPatch({ estimated_hours: event.target.value ? Number(event.target.value) : null })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span>Actual hours</span>
              <input
                type="number"
                min="0"
                defaultValue={currentTask.actual_hours ?? ''}
                onBlur={(event) => void saveTaskPatch({ actual_hours: event.target.value ? Number(event.target.value) : null })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
          </div>

          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </div>

        <div className="bg-[linear-gradient(180deg,rgba(15,23,42,0.55),rgba(2,6,23,0.2))] px-5 py-5">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                  activeTab === tab.id
                    ? tab.accent ?? 'border-white/30 bg-white/10 text-slate-100'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-5">
            {activeTab === 'overview' ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-300">Description</p>
                  <textarea
                    defaultValue={currentTask.description ?? ''}
                    rows={6}
                    onBlur={(event) => void saveTaskPatch({ description: event.target.value || null })}
                    className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-300">Custom fields</p>
                    <button
                      type="button"
                      onClick={() => {
                        const nextFields = { ...currentTask.custom_fields, [`Field ${Object.keys(currentTask.custom_fields).length + 1}`]: '' }
                        void saveTaskPatch({ custom_fields: nextFields })
                      }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200"
                    >
                      Add field
                    </button>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(currentTask.custom_fields).map(([key, value]) => (
                      <div key={key} className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_auto]">
                        <input
                          defaultValue={key}
                          onBlur={(event) => {
                            const nextKey = event.target.value.trim()
                            if (!nextKey || nextKey === key) {
                              return
                            }
                            const nextFields = { ...currentTask.custom_fields }
                            const previousValue = nextFields[key]
                            delete nextFields[key]
                            nextFields[nextKey] = previousValue
                            void saveTaskPatch({ custom_fields: nextFields })
                          }}
                          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                        />
                        <input
                          defaultValue={String(value ?? '')}
                          onBlur={(event) => {
                            const nextFields = { ...currentTask.custom_fields, [key]: event.target.value }
                            void saveTaskPatch({ custom_fields: nextFields })
                          }}
                          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextFields = { ...currentTask.custom_fields }
                            delete nextFields[key]
                            void saveTaskPatch({ custom_fields: nextFields })
                          }}
                          className="rounded-2xl border border-rose-400/30 px-4 py-3 text-xs text-rose-200"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-slate-300">Dependencies</p>
                  <div className="flex flex-wrap gap-2">
                    {currentDependencies.map((item) => {
                      const dependencyTask = dependencyTaskMap.get(item.depends_on_task_id)
                      return (
                        <span key={item.id} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                          <span>[link]</span>
                          <span>{item.type}</span>
                          <button type="button" onClick={() => void onOpenTask(item.depends_on_task_id)} className="text-sky-300">
                            {dependencyTask?.title ?? 'Linked task'}
                          </button>
                          <button type="button" onClick={() => void removeDependency(item.id)} className="text-rose-300">
                            x
                          </button>
                        </span>
                      )
                    })}
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      value={dependencySearch}
                      onChange={(event) => setDependencySearch(event.target.value)}
                      placeholder="Search project tasks"
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    />
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {availableDependencyTasks.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{entry.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{entry.status.replace('_', ' ')}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void addDependency('blocks', entry.id)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">
                              Blocks
                            </button>
                            <button type="button" onClick={() => void addDependency('blocked_by', entry.id)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">
                              Blocked by
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'subtasks' ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-100">{childTasks.filter((entry) => entry.status === 'done').length} of {childTasks.length} complete</p>
                    <PriorityBadge priority={currentTask.priority} />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-blue-500" style={{ width: `${childTasks.length > 0 ? (childTasks.filter((entry) => entry.status === 'done').length / childTasks.length) * 100 : 0}%` }} />
                  </div>
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void handleSubtaskDragEnd(event)}>
                  <SortableContext items={childTasks.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {nestedChildTasks.slice(0, 12).map((entry) => (
                        <SortableSubtaskRow
                          key={entry.id}
                          task={entry}
                          onToggle={() => void toggleSubtask(entry)}
                          onOpen={() => onOpenTask(entry.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-2">
                  <input
                    value={newSubtaskTitle}
                    onChange={(event) => setNewSubtaskTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void createSubtask()
                      }
                    }}
                    placeholder="Add subtask"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <button type="button" onClick={() => void createSubtask()} className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200">
                    Add
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === 'checklist' ? (
              <div className="space-y-5">
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void handleChecklistDragEnd(event)}>
                  <SortableContext items={currentChecklistItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {currentChecklistItems.map((item) => (
                        <SortableChecklistRow
                          key={item.id}
                          item={item}
                          onToggle={() => void updateChecklistItem(item.id, { is_complete: !item.is_complete })}
                          onTitleChange={(value) => void updateChecklistItem(item.id, { title: value })}
                          onDelete={() => void deleteChecklistItem(item.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="flex gap-2">
                  <input
                    value={newChecklistTitle}
                    onChange={(event) => setNewChecklistTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void addChecklistItem()
                      }
                    }}
                    placeholder="Add checklist item"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <button type="button" onClick={() => void addChecklistItem()} className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200">
                    Add
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === 'attachments' ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200">
                    <input type="file" className="hidden" onChange={handleAttachmentUpload} />
                    {uploading ? 'Uploading...' : 'Upload file'}
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {currentAttachments.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                      <button type="button" onClick={() => void openAttachment(item)} className="w-full text-left">
                        <div className="flex h-28 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-xs text-slate-500">
                          {item.mime_type?.startsWith('image/') ? 'Image preview' : (item.mime_type?.split('/')[1] ?? 'File').toUpperCase()}
                        </div>
                        <p className="mt-3 truncate text-sm font-medium text-slate-100">{item.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.file_size ? `${Math.round(item.file_size / 1024)} KB` : 'Unknown size'} · {item.uploaded_by ?? 'Unknown'} · {formatTaskDate(item.created_at.slice(0, 10))}</p>
                      </button>
                      <div className="mt-3 flex justify-end">
                        <button type="button" onClick={() => void deleteAttachment(item.id, item.storage_path)} className="text-xs text-rose-300">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === 'time-log' ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-100">{timeLogged.toFixed(1)} hrs logged / {estimated} hrs estimated</p>
                    <p className="text-xs text-slate-500">Tracked manually</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${estimated > 0 ? Math.min((timeLogged / estimated) * 100, 100) : 0}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  {currentTimeLogs.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{entry.description || 'Time entry'}</p>
                        <p className="mt-1 text-xs text-slate-500">{entry.hours} hrs · {entry.logged_date} · {entry.logged_by ?? 'Unknown'}</p>
                      </div>
                      {currentUserLabel && entry.logged_by === currentUserLabel ? (
                        <button type="button" onClick={() => void deleteTimeLog(entry.id)} className="text-xs text-rose-300">
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    value={timeDraft.description}
                    onChange={(event) => setTimeDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Description"
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 md:col-span-2"
                  />
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={timeDraft.hours}
                    onChange={(event) => setTimeDraft((current) => ({ ...current, hours: event.target.value }))}
                    placeholder="Hours"
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <input
                    type="date"
                    value={timeDraft.logged_date}
                    onChange={(event) => setTimeDraft((current) => ({ ...current, logged_date: event.target.value }))}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <button type="button" onClick={() => void addTimeLog()} className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200 md:col-span-2">
                    Log time
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === 'activity' ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  {currentActivity.map((entry) => {
                    const isOwnComment = entry.type === 'comment' && currentUserLabel && entry.created_by === currentUserLabel
                    return (
                      <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] text-slate-200">
                                {(entry.created_by ?? 'System').slice(0, 2).toUpperCase()}
                              </span>
                              <span>{entry.created_by ?? 'System'}</span>
                              <span>{formatDateTime(entry.created_at)}</span>
                              {entry.updated_at !== entry.created_at ? <span>(edited)</span> : null}
                            </div>
                            {isOwnComment ? (
                              <textarea
                                defaultValue={entry.content ?? ''}
                                onBlur={(event) => {
                                  const nextValue = event.target.value.trim()
                                  if (nextValue && nextValue !== (entry.content ?? '')) {
                                    void updateComment(entry.id, nextValue)
                                  }
                                }}
                                rows={3}
                                className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100"
                              />
                            ) : (
                              <p className="mt-3 text-sm text-slate-200">{entry.content}</p>
                            )}
                          </div>
                          {isOwnComment ? (
                            <button type="button" onClick={() => void deleteComment(entry.id)} className="text-xs text-rose-300">
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    rows={4}
                    placeholder="Add a comment"
                    className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                  <button type="button" onClick={() => void addComment()} className="rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-200">
                    Submit comment
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex justify-between gap-3 border-t border-slate-800 pt-5">
            <div className="flex items-center gap-2">
              <PriorityBadge priority={currentTask.priority} />
              <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${getTaskStatusClasses(currentTask.status)}`}>
                {currentTask.status.replace('_', ' ')}
              </span>
            </div>
            <button type="button" onClick={() => void deleteTask()} className="rounded-2xl border border-rose-400/30 px-4 py-3 text-sm text-rose-200">
              Delete task
            </button>
          </div>
        </div>
      </aside>

      {previewUrl ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="Attachment preview" className="max-h-full max-w-full rounded-2xl" />
        </div>
      ) : null}
    </>
  )
}