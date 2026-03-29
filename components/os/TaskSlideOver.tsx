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
  TaskPriority,
  TaskWithWorkstream,
  Workstream,
} from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import SearchSelect, { type SearchSelectOption } from './SearchSelect'
import WorkstreamBadge from './WorkstreamBadge'

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

interface TaskSlideOverProps {
  open: boolean
  onClose: () => void
  task?: TaskWithWorkstream | null
  workstreams: Workstream[]
  defaultWorkstreamId?: string | null
  defaultColumnId?: string | null
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
  onSaved,
  onDeleted,
}: TaskSlideOverProps) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [workstreamId, setWorkstreamId] = useState<string>('')
  const [accountId, setAccountId] = useState<string>('')
  const [contactId, setContactId] = useState<string>('')
  const [isMasterTodo, setIsMasterTodo] = useState(true)
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [relationsLoading, setRelationsLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setPriority(task?.priority ?? 'medium')
    setDueDate(task?.due_date ?? '')
    setWorkstreamId(task?.workstream_id ?? defaultWorkstreamId ?? '')
    setAccountId(task?.account_id ?? '')
    setContactId(task?.contact_id ?? '')
    setIsMasterTodo(task?.is_master_todo ?? !defaultWorkstreamId)
    setTags(task?.tags.join(', ') ?? '')
    setError(null)
    setNoteDraft('')
    setNoteError(null)
  }, [defaultWorkstreamId, open, task])

  useEffect(() => {
    async function loadRelations() {
      if (!open) {
        return
      }

      setRelationsLoading(true)

      try {
        const [accountsResponse, contactsResponse] = await Promise.all([
          apiFetch<{ accounts: Account[] }>('/api/accounts'),
          apiFetch<{ contacts: Contact[] }>('/api/contacts'),
        ])

        setAccounts(accountsResponse.accounts)
        setContacts(contactsResponse.contacts)
      } catch {
        setAccounts([])
        setContacts([])
      } finally {
        setRelationsLoading(false)
      }
    }

    loadRelations()
  }, [open])

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
        workstream_id: workstreamId || null,
        column_id: task?.column_id ?? defaultColumnId ?? null,
        account_id: accountId || null,
        contact_id: contactId || null,
        is_master_todo: isMasterTodo,
        tags: tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      }

      if (task?.id) {
        const response = await apiFetch<{ task: TaskWithWorkstream }>(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        onSaved?.(response.task)
      } else {
        const response = await apiFetch<{ task: TaskWithWorkstream }>('/api/tasks', {
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
      await apiFetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
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

  const currentWorkstream = workstreams.find((entry) => entry.id === (workstreamId || task?.workstream_id))
  const accountOptions: SearchSelectOption[] = accounts.map((account) => ({
    value: account.id,
    label: account.name,
    meta:
      workstreams.find((workstream) => workstream.id === account.workstream_id)?.label ??
      account.industry ??
      null,
  }))
  const contactOptions: SearchSelectOption[] = contacts
    .filter((contact) => !accountId || contact.account_id === accountId)
    .map((contact) => ({
      value: contact.id,
      label: contact.name,
      meta: contact.company ?? contact.email ?? null,
    }))

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/65">
      <button
        type="button"
        aria-label="Close task panel"
        className="flex-1"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              {task ? 'Task detail' : 'New task'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">
              {task ? task.title : 'Create a task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300"
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
            <span className="text-xs text-slate-500">Updated {formatDateTime(task.updated_at)}</span>
          ) : null}
        </div>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Workstream</span>
              <select
                value={workstreamId}
                onChange={(event) => setWorkstreamId(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
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
              <span className="mb-2 block text-sm font-medium text-slate-300">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              >
                {PRIORITIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <input
                type="checkbox"
                checked={isMasterTodo}
                onChange={(event) => setIsMasterTodo(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              <span className="text-sm text-slate-200">Show on master to-do</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SearchSelect
              label="Account"
              value={accountId}
              options={accountOptions}
              onChange={setAccountId}
              placeholder="Search accounts"
              emptyLabel={relationsLoading ? 'Loading accounts...' : 'No account'}
              disabled={relationsLoading}
            />
            <SearchSelect
              label="Contact"
              value={contactId}
              options={contactOptions}
              onChange={setContactId}
              placeholder="Search contacts"
              emptyLabel={relationsLoading ? 'Loading contacts...' : 'No contact'}
              disabled={relationsLoading}
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="client, follow-up, launch"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            />
          </label>
        </div>

        {task?.id ? (
          <section className="mt-10 space-y-4 border-t border-slate-800 pt-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Notes</h3>
              <p className="text-sm text-slate-400">Keep task context close to the card.</p>
            </div>

            <form className="space-y-2" onSubmit={handleAddNote}>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                rows={3}
                placeholder="Add a note..."
                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100"
              >
                Add note
              </button>
            </form>

            {noteError ? <p className="text-sm text-rose-300">{noteError}</p> : null}

            <div className="space-y-3">
              {notesLoading ? (
                <p className="text-sm text-slate-500">Loading notes...</p>
              ) : notes.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">
                  No notes yet.
                </p>
              ) : (
                notes.map((note) => (
                  <article key={note.id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                    {note.title ? <h4 className="font-medium text-slate-100">{note.title}</h4> : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{note.body}</p>
                    <p className="mt-3 text-xs text-slate-500">{formatDateTime(note.updated_at)}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {error ? <p className="mt-6 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6">
          <div>
            {task?.id ? (
              <button
                type="button"
                onClick={handleComplete}
                disabled={deleting}
                className="rounded-2xl border border-rose-500/30 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-60"
              >
                {deleting ? 'Completing...' : 'Mark complete'}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  )
}
