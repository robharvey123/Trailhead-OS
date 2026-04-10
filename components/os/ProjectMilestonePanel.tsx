'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTaskDate } from '@/lib/os'
import type { ProjectMilestone, TaskWithWorkstream } from '@/lib/types'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'missed', label: 'Missed' },
] as const

function getMilestoneStatusClasses(status: ProjectMilestone['status']) {
  if (status === 'achieved') {
    return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
  }

  if (status === 'missed') {
    return 'border-red-500/40 bg-red-500/10 text-red-100'
  }

  return 'border-sky-500/40 bg-sky-500/10 text-sky-100'
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
  const [colour, setColour] = useState('#0f766e')
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
    setColour(milestone?.colour ?? '#0f766e')
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
      <div className="fixed inset-0 z-40 bg-[#0C0C14]/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-[560px] translate-x-0 overflow-y-auto border-l border-[#2A2A3A] bg-[#0C0C14] shadow-2xl transition-transform duration-300">
        <div className="sticky top-0 z-10 border-b border-[#2A2A3A] bg-[#1A1A28] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">Milestone</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full bg-transparent text-2xl font-semibold text-white outline-none"
                placeholder="Milestone title"
              />
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-[#2A2A3A] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#9CA3AF]">
              Close
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getMilestoneStatusClasses(status)}`}>
              {status}
            </span>
            <span className="text-xs text-[#9CA3AF]">{dueDate ? formatTaskDate(dueDate) : 'No due date'}</span>
          </div>
        </div>

        <div className="space-y-5 bg-[#0C0C14] px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[#9CA3AF]">
              <span>Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="space-y-2 text-sm text-[#9CA3AF]">
              <span>Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ProjectMilestone['status'])}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-[#9CA3AF]">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              className="w-full rounded-[1.5rem] border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white"
            />
          </label>

          <label className="space-y-2 text-sm text-[#9CA3AF]">
            <span>Colour</span>
            <div className="flex items-center gap-3 rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3">
              <input type="color" value={colour} onChange={(event) => setColour(event.target.value)} className="h-10 w-16 rounded border border-[#2A2A3A] bg-transparent" />
              <span className="text-sm text-white">{colour}</span>
            </div>
          </label>

          <div className="rounded-[1.5rem] border border-[#2A2A3A] bg-[#13131E] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Linked tasks</p>
              <span className="text-xs text-[#9CA3AF]">{linkedTasks.length} linked</span>
            </div>
            {linkedTasks.length === 0 ? (
              <p className="mt-3 text-sm text-[#9CA3AF]">No tasks are explicitly linked to this milestone yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {linkedTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] px-3 py-3">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    <p className="mt-1 text-xs text-[#9CA3AF]">{task.status.replace('_', ' ')} {task.due_date ? `· ${formatTaskDate(task.due_date)}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <div className="flex justify-end gap-3 border-t border-[#2A2A3A] pt-5">
            <button type="button" onClick={onClose} className="rounded-2xl border border-[#2A2A3A] px-4 py-3 text-sm text-[#9CA3AF]">
              Cancel
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={saving || !title.trim() || !dueDate} className="rounded-2xl bg-[#B8FF00] px-4 py-3 text-sm font-bold text-[#0C0C14] disabled:opacity-60">
              {saving ? 'Saving...' : milestone ? 'Save milestone' : 'Create milestone'}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}