'use client'

import { useState } from 'react'
import type { TaskRow, TaskTemplate, ChecklistItem } from '@/lib/workspace/types'
import { WORKSPACE_CATEGORY_LABELS } from '@/lib/workspace/constants'

interface TaskModalProps {
  task: TaskRow | null
  templates?: TaskTemplate[]
  onClose: () => void
  onCreate?: (payload: Record<string, unknown>) => Promise<TaskRow>
  onUpdate?: (taskId: string, payload: Record<string, unknown>, scope?: 'single' | 'series') => Promise<TaskRow>
  onDelete?: (taskId: string, scope?: 'single' | 'series') => Promise<void>
}

const PRIORITIES = ['low', 'medium', 'high'] as const
const STATUS_OPTIONS: TaskRow['status'][] = ['open', 'assigned', 'in_progress', 'done', 'cancelled']
const CATEGORIES = Object.entries(WORKSPACE_CATEGORY_LABELS)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function TaskModal({ task, templates, onClose, onCreate, onUpdate, onDelete }: TaskModalProps) {
  const isEdit = Boolean(task)
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [scheduledDate, setScheduledDate] = useState(task?.scheduled_date || todayStr())
  const [category, setCategory] = useState(task?.category || '')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [status, setStatus] = useState(task?.status || 'open')
  const [durationMinutes, setDurationMinutes] = useState(task?.duration_minutes || 60)
  const [requiredPeople, setRequiredPeople] = useState(task?.required_people || 1)
  const [plannedStartTime, setPlannedStartTime] = useState(task?.planned_start_time || '')
  const [taskColor, setTaskColor] = useState(task?.task_color || '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist_items || [])
  const [newCheckItem, setNewCheckItem] = useState('')

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'info'>('details')

  const isSeries = Boolean(task?.recurrence_parent_task_id || task?.recurrence_cadence)

  function applyTemplate(tmpl: TaskTemplate) {
    setTitle(tmpl.title)
    setDescription(tmpl.description || '')
    setCategory(tmpl.category || '')
    setPriority((tmpl.priority as 'low' | 'medium' | 'high') || 'medium')
    setDurationMinutes(tmpl.duration_minutes)
    setRequiredPeople(tmpl.required_people)
    setPlannedStartTime(tmpl.planned_start_time || '')
    setTaskColor(tmpl.task_color || '')
    setChecklist(tmpl.checklist_items || [])
  }

  async function handleSave() {
    if (!title.trim()) {
      setErrorMsg('Title is required')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        scheduled_date: scheduledDate,
        category: category || null,
        priority,
        duration_minutes: durationMinutes,
        required_people: requiredPeople,
        planned_start_time: plannedStartTime || null,
        task_color: taskColor || null,
        checklist_items: checklist,
      }
      if (isEdit && onUpdate && task) {
        payload.status = status
        await onUpdate(task.id, payload)
      } else if (onCreate) {
        await onCreate(payload)
      }
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    setSaving(true)
    try {
      await onDelete(task.id)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred')
      setSaving(false)
    }
  }

  function addCheckItem() {
    const text = newCheckItem.trim()
    if (!text) return
    setChecklist([...checklist, { id: crypto.randomUUID(), title: text, done: false }])
    setNewCheckItem('')
  }

  function toggleCheckItem(id: string) {
    setChecklist(checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)))
  }

  function removeCheckItem(id: string) {
    setChecklist(checklist.filter((c) => c.id !== id))
  }

  const inputClasses = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-100">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-300">
            ✕
          </button>
        </div>

        {/* Template picker for create */}
        {!isEdit && templates && templates.length > 0 && (
          <div className="border-b border-slate-800 px-5 py-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Start from template</p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => applyTemplate(tmpl)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  {tmpl.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-5 text-sm">
          {(['details', 'checklist', ...(isEdit ? ['info'] : [])] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'details' | 'checklist' | 'info')}
              className={`border-b-2 px-3 py-2 capitalize transition ${
                activeTab === tab ? 'border-white/60 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab}
              {tab === 'checklist' && checklist.length > 0 ? ` (${checklist.length})` : ''}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClasses}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputClasses}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Start time</label>
                  <input
                    type="time"
                    value={plannedStartTime}
                    onChange={(e) => setPlannedStartTime(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">None</option>
                    {CATEGORIES.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className={inputClasses}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {isEdit && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TaskRow['status'])}
                      className={inputClasses}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Duration (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">People needed</label>
                  <input
                    type="number"
                    min={1}
                    value={requiredPeople}
                    onChange={(e) => setRequiredPeople(Number(e.target.value))}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Color</label>
                  <input
                    type="color"
                    value={taskColor || '#6366f1'}
                    onChange={(e) => setTaskColor(e.target.value)}
                    className="h-9 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-950"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleCheckItem(item.id)}
                    className="rounded border-slate-600"
                  />
                  <span className={`flex-1 text-sm ${item.done ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                    {item.title}
                  </span>
                  <button
                    onClick={() => removeCheckItem(item.id)}
                    className="text-xs text-slate-500 transition hover:text-rose-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add checklist item..."
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCheckItem()}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
                />
                <button
                  onClick={addCheckItem}
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-white"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {activeTab === 'info' && task && (
            <div className="space-y-3 text-sm text-slate-400">
              {(task.assignments || []).length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-slate-300">Assigned to</p>
                  <div className="flex flex-wrap gap-1">
                    {task.assignments.map((a) => (
                      <span key={a.id} className="rounded bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                        {a.profile_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(task.blocked_by_tasks || []).length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-slate-300">Blocked by</p>
                  {task.blocked_by_tasks.map((dep) => (
                    <div key={dep.id} className="text-xs text-slate-400">
                      {dep.title} ({dep.status})
                    </div>
                  ))}
                </div>
              )}
              {(task.blocking_tasks || []).length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-slate-300">Blocking</p>
                  {task.blocking_tasks.map((dep) => (
                    <div key={dep.id} className="text-xs text-slate-400">
                      {dep.title} ({dep.status})
                    </div>
                  ))}
                </div>
              )}
              {isSeries && (
                <div className="text-xs text-cyan-400">This task is part of a recurring series.</div>
              )}
              {task.created_at && (
                <div className="text-xs text-slate-600">Created: {new Date(task.created_at).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mx-5 mb-3 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
          <div>
            {isEdit && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400">Delete{isSeries ? ' entire series' : ''}?</span>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-rose-500 hover:text-rose-400"
                >
                  Delete
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-white/90 px-4 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
