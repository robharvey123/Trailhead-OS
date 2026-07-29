'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { formatDateTime } from '@/lib/os'
import { createClient } from '@/lib/supabase/client'
import type {
  Account,
  Contact,
  Note,
  ProjectListItem,
  TaskPriority,
  TaskWithWorkstream,
  Workstream,
} from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import ProjectSelector from './ProjectSelector'
import EntityCombobox from './EntityCombobox'
import TaskEmailModal from './TaskEmailModal'
import WorkstreamBadge from './WorkstreamBadge'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

interface TaskSlideOverProps {
  open: boolean
  onClose: () => void
  task?: TaskWithWorkstream | null
  workstreams: Workstream[]
  defaultWorkstreamId?: string | null
  defaultColumnId?: string | null
  accounts?: Account[]
  contacts?: Contact[]
  projects?: ProjectListItem[]
  onSaved?: (task: TaskWithWorkstream) => void
  onDeleted?: (taskId: string) => void
}

export default function TaskSlideOver({
  open,
  onClose,
  task,
  workstreams,
  defaultWorkstreamId = null,
  defaultColumnId = null,
  accounts = [],
  contacts = [],
  projects = [],
  onSaved,
  onDeleted,
}: TaskSlideOverProps) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [workstreamId, setWorkstreamId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [contactId, setContactId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [isMasterTodo, setIsMasterTodo] = useState(true)
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setPriority(task?.priority ?? 'medium')
    setDueDate(task?.due_date ?? '')
    setDueTime(task?.due_time?.slice(0, 5) ?? '')
    setWorkstreamId(task?.workstream_id ?? defaultWorkstreamId ?? '')
    setAccountId(task?.account_id ?? '')
    setContactId(task?.contact_id ?? '')
    setProjectId(task?.project_id ?? '')
    setIsMasterTodo(task?.is_master_todo ?? !defaultWorkstreamId)
    setTags(task?.tags.join(', ') ?? '')
    setError(null)
    setNoteDraft('')
    setNoteError(null)
  }, [defaultWorkstreamId, open, task])

  useEffect(() => {
    async function loadNotes() {
      if (!open || !task?.id) {
        setNotes([])
        return
      }

      setNotesLoading(true)
      setNoteError(null)

      const { data, error: notesLoadError } = await supabase
        .from('notes')
        .select('id, workstream_id, task_id, title, body, created_at, updated_at')
        .eq('task_id', task.id)
        .order('updated_at', { ascending: false })

      if (notesLoadError) {
        setNoteError(notesLoadError.message)
      } else {
        setNotes((data ?? []) as Note[])
      }

      setNotesLoading(false)
    }

    loadNotes()
  }, [open, supabase, task?.id])

  useEffect(() => {
    if (!accountId || !contactId) {
      return
    }

    const contactMatchesAccount = contacts.some(
      (contact) => contact.id === contactId && contact.account_id === accountId
    )

    if (!contactMatchesAccount) {
      setContactId('')
    }
  }, [accountId, contactId, contacts])

  useEffect(() => {
    if (!projectId) {
      return
    }

    const projectMatchesWorkstream = projects.some(
      (project) => project.id === projectId && (!workstreamId || project.workstream_id === workstreamId)
    )

    if (!projectMatchesWorkstream) {
      setProjectId('')
    }
  }, [projectId, projects, workstreamId])

  if (!open) {
    return null
  }

  async function handleSave() {
    const nextTitle = title.trim()
    if (!nextTitle || saving) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        title: nextTitle,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        due_time: dueDate && dueTime ? dueTime : null,
        workstream_id: workstreamId || null,
        column_id: task?.column_id ?? defaultColumnId ?? null,
        account_id: accountId || null,
        contact_id: contactId || null,
        project_id: projectId || null,
        is_master_todo: isMasterTodo,
        tags: tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }

      if (task?.id) {
        const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/os/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        onSaved?.(response.task)
      } else {
        const response = await apiFetch<{ task: TaskWithWorkstream }>('/api/os/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        onSaved?.(response.task)
      }

      router.refresh()
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete() {
    if (!task?.id || deleting) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await apiFetch(`/api/os/tasks/${task.id}`, { method: 'DELETE' })
      onDeleted?.(task.id)
      router.refresh()
      onClose()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to complete task')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!task?.id || !noteDraft.trim()) {
      return
    }

    setNoteError(null)

    const { data, error: insertError } = await supabase
      .from('notes')
      .insert({
        task_id: task.id,
        workstream_id: task.workstream_id,
        body: noteDraft.trim(),
      })
      .select('id, workstream_id, task_id, title, body, created_at, updated_at')
      .single()

    if (insertError) {
      setNoteError(insertError.message)
      return
    }

    setNotes((current) => [data as Note, ...current])
    setNoteDraft('')
  }

  const currentWorkstream = workstreams.find(
    (entry) => entry.id === (workstreamId || task?.workstream_id)
  )
  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: account.name,
  }))
  const contactOptions = contacts.map((contact) => ({
    value: contact.id,
    label: contact.name,
  }))
  const projectOptions = projects.filter(
    (project) => !workstreamId || project.workstream_id === workstreamId
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.45)]">
      <button
        type="button"
        aria-label="Close task panel"
        className="flex-1"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="os-eyebrow text-[color:var(--accent-strong)]">
              {task ? 'Task detail' : 'New task'}
            </p>
            <h2 className="os-section-title mt-2">
              {task ? task.title : 'Create a task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[color:var(--text-2)]"
          >
            Close
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={priority} />
          {currentWorkstream ? (
            <WorkstreamBadge
              label={currentWorkstream.label}
              slug={currentWorkstream.slug}
              colour={currentWorkstream.colour}
            />
          ) : null}
          {task?.updated_at ? (
            <span className="text-xs text-[color:var(--text-2)]">Updated {formatDateTime(task.updated_at)}</span>
          ) : null}
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="os-input w-full"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Workstream</span>
              <select
                value={workstreamId}
                onChange={(event) => setWorkstreamId(event.target.value)}
                className="os-select w-full"
              >
                <option value="">No workstream</option>
                {workstreams.map((workstream) => (
                  <option key={workstream.id} value={workstream.id}>
                    {workstream.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="os-select w-full"
              >
                {PRIORITIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => {
                  const nextDate = event.target.value
                  setDueDate(nextDate)
                  if (!nextDate) {
                    setDueTime('')
                  }
                }}
                className="os-input w-full"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Due time</span>
              <input
                type="time"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                disabled={!dueDate}
                className="os-input w-full disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <input
                type="checkbox"
                checked={isMasterTodo}
                onChange={(event) => setIsMasterTodo(event.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--border)] bg-white"
              />
              <span className="text-sm text-[color:var(--text-2)]">Show on master to-do</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <EntityCombobox
              label="Account"
              entity="account"
              value={accountId}
              selectedLabel={accountOptions.find((o) => o.value === accountId)?.label}
              onChange={(opt) => setAccountId(opt.id)}
              clearable
            />
            <EntityCombobox
              label="Contact"
              entity="contact"
              value={contactId}
              selectedLabel={contactOptions.find((o) => o.value === contactId)?.label}
              filters={accountId ? { account_id: accountId } : undefined}
              onChange={(opt) => setContactId(opt.id)}
              clearable
            />
          </div>

          <ProjectSelector
            label="Project"
            value={projectId}
            projects={projectOptions}
            onChange={setProjectId}
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="client, follow-up, launch"
              className="os-input w-full"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              className="os-textarea w-full rounded-3xl"
            />
          </label>
        </div>

        {task?.id ? (
          <section className="mt-10 space-y-4 border-t border-[color:var(--border)] pt-8">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--text)]">Notes</h3>
              <p className="text-sm text-[color:var(--text-2)]">Keep task context close to the card.</p>
            </div>

            <form className="space-y-2" onSubmit={handleAddNote}>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                placeholder="Add a note..."
                className="os-textarea w-full rounded-3xl"
              />
              <button
                type="submit"
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:bg-[var(--surface-2)]"
              >
                Add note
              </button>
            </form>

            {noteError ? <p className="text-sm text-[color:var(--red-strong)]">{noteError}</p> : null}

            <div className="space-y-3">
              {notesLoading ? (
                <p className="text-sm text-[color:var(--text-2)]">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--text-2)]">
                  No notes yet.
                </p>
              ) : (
                notes.map((note) => (
                  <article key={note.id} className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                    {note.title ? <h4 className="font-medium text-[color:var(--text)]">{note.title}</h4> : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">{note.body}</p>
                    <p className="mt-3 text-xs text-[color:var(--text-3)]">{formatDateTime(note.updated_at)}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {error ? <p className="mt-6 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-6">
          <div className="flex items-center gap-2">
            {task?.id ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={deleting}
                className="rounded-2xl border border-[color:var(--red)] px-4 py-2 text-sm font-medium text-[color:var(--red-strong)] transition hover:bg-[var(--red-dim)] disabled:opacity-60"
              >
                {deleting ? 'Completing...' : 'Mark complete'}
              </button>
            ) : null}
            {task?.id ? (
              <button
                type="button"
                onClick={() => setEmailModalOpen(true)}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
              >
                Email task
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>

        {task ? (
          <TaskEmailModal
            open={emailModalOpen}
            onOpenChange={setEmailModalOpen}
            tasks={[task]}
          />
        ) : null}
      </div>
    </div>
  )
}
