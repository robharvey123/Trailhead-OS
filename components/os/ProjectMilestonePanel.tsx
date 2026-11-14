'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTaskDate } from '@/lib/os'
import type { ProjectMilestone, TaskWithWorkstream } from '@/lib/types'
import { WORKSTREAM_COLOURS } from '@/lib/workstreams'

// The colour a new milestone's picker starts on. It is a data default, saved on
// the record, so it is read from the colour map and no hex is written here.
const DEFAULT_MILESTONE_COLOUR = WORKSTREAM_COLOURS['brand-sales'].ink.toLowerCase()

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'missed', label: 'Missed' },
] as const

function getMilestoneStatusClasses(status: ProjectMilestone['status']) {
  if (status === 'achieved') {
    return 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]'
  }

  if (status === 'missed') {
    return 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]'
  }

  return 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
}

export default function ProjectMilestonePanel({
  open,
  projectId,
  milestone,
  tasks,
  onClose,
  onSaved,
  onCreated,
}: {
  open: boolean
  projectId: string
  milestone: ProjectMilestone | null
  tasks: TaskWithWorkstream[]
  onClose: () => void
  onSaved: (milestone: ProjectMilestone) => void
  onCreated: (milestone: ProjectMilestone) => void
}) {
  const [supabase] = useState(() => createClient())
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<ProjectMilestone['status']>('pending')
  const [description, setDescription] = useState('')
  const [colour, setColour] = useState(DEFAULT_MILESTONE_COLOUR)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setTitle(milestone?.title ?? '')
    setDueDate(milestone?.due_date ?? '')
    setStatus(milestone?.status ?? 'pending')
    setDescription(milestone?.description ?? '')
    setColour(milestone?.colour ?? DEFAULT_MILESTONE_COLOUR)
    setError(null)
  }, [milestone, open])

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

  const linkedTasks = useMemo(
    () =>
      milestone
        ? tasks.filter((task) => {
            const milestoneId = task.custom_fields.milestone_id ?? task.custom_fields.milestoneId
            return milestoneId === milestone.id
          })
        : [],
    [milestone, tasks]
  )

  if (!open) {
    return null
  }

  async function handleSave() {
    const nextTitle = title.trim()
    if (!nextTitle || !dueDate || saving) {
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      project_id: projectId,
      title: nextTitle,
      name: nextTitle,
      due_date: dueDate,
      date: dueDate,
      status,
      completed: status === 'achieved',
      description: description.trim() || null,
      colour,
      order_index: milestone?.order_index ?? 0,
    }

    try {
      if (milestone?.id) {
        const { data, error: updateError } = await supabase
          .from('project_milestones')
          .update(payload)
          .eq('id', milestone.id)
          .select('*')
          .single()

        if (updateError) {
          throw updateError
        }

        onSaved(data as ProjectMilestone)
      } else {
        const { data, error: insertError } = await supabase
          .from('project_milestones')
          .insert(payload)
          .select('*')
          .single()

        if (insertError) {
          throw insertError
        }

        onCreated(data as ProjectMilestone)
      }

      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save milestone')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--navy)]/45 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[560px] translate-x-0 overflow-y-auto border-l border-[color:var(--border)] bg-[var(--bg)] shadow-[var(--shadow-lg)] transition-transform duration-300">
        <div className="sticky top-0 z-10 border-b border-[color:var(--border)] bg-[var(--surface)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="os-eyebrow">Milestone</p>
              <input
                aria-label="Milestone title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full bg-transparent text-2xl font-semibold text-[color:var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-strong)]"
                placeholder="Milestone title"
              />
            </div>
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0">
              Close
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className={`inline-flex rounded-pill border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] ${getMilestoneStatusClasses(status)}`}>
              {status}
            </span>
            <span className="text-xs text-[color:var(--text-2)]">{dueDate ? formatTaskDate(dueDate) : 'No due date'}</span>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="os-input w-full px-4 py-3 text-sm"
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectMilestone['status'])}
                className="os-select w-full px-4 py-3 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="field-label">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              className="os-textarea w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Colour</span>
            <div className="flex items-center gap-3 rounded-control border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <input type="color" value={colour} onChange={(event) => setColour(event.target.value)} className="h-10 w-16 rounded-control border border-[color:var(--border)] bg-transparent" />
              <span className="text-sm text-[color:var(--text)]">{colour}</span>
            </div>
          </label>

          <div className="rounded-card border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[color:var(--text)]">Linked tasks</p>
              <span className="text-xs text-[color:var(--text-2)]">{linkedTasks.length} linked</span>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--text-2)]">No tasks are explicitly linked to this milestone yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {linkedTasks.map((task) => (
                  <div key={task.id} className="rounded-control border border-[color:var(--border)] bg-[var(--bg)] px-3 py-3">
                    <p className="text-sm font-medium text-[color:var(--text)]">{task.title}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-2)]">{task.status.replace('_', ' ')} {task.due_date ? `· ${formatTaskDate(task.due_date)}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}

          <div className="flex justify-end gap-3 border-t border-[color:var(--border)] pt-5">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !title.trim() || !dueDate} className="btn btn-primary">
              {saving ? 'Saving...' : milestone ? 'Save milestone' : 'Create milestone'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}