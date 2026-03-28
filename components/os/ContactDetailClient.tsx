'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import WorkstreamBadge from './WorkstreamBadge'
import StatusBadge from './StatusBadge'
import type { Contact, ContactStatus, TaskWithWorkstream, Workstream } from '@/lib/types'

const CONTACT_STATUSES: ContactStatus[] = ['lead', 'active', 'inactive', 'archived']

type ContactWithWorkstream = Contact & {
  workstream?: Workstream | null
}

export default function ContactDetailClient({
  initialContact,
  workstreams,
  linkedTasks,
  sourceEnquiryId,
}: {
  initialContact: ContactWithWorkstream
  workstreams: Workstream[]
  linkedTasks: TaskWithWorkstream[]
  sourceEnquiryId: string | null
}) {
  const router = useRouter()
  const [contact, setContact] = useState(initialContact)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: initialContact.name,
    company: initialContact.company ?? '',
    email: initialContact.email ?? '',
    phone: initialContact.phone ?? '',
    role: initialContact.role ?? '',
    workstream_id: initialContact.workstream_id ?? '',
    status: initialContact.status,
  })
  const [notes, setNotes] = useState(initialContact.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesError, setNotesError] = useState<string | null>(null)

  async function saveChanges() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          company: form.company,
          email: form.email,
          phone: form.phone,
          role: form.role,
          workstream_id: form.workstream_id || null,
          status: form.status,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save contact')
      }

      const updatedContact = data.contact as Contact
      const selectedWorkstream =
        workstreams.find((item) => item.id === updatedContact.workstream_id) ?? null

      setContact({
        ...updatedContact,
        workstream: selectedWorkstream,
      })
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  async function saveNotesOnBlur() {
    if ((contact.notes ?? '') === notes) {
      return
    }

    setNotesSaving(true)
    setNotesError(null)

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save notes')
      }

      setContact((current) => ({
        ...current,
        notes: data.contact.notes,
      }))
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Contact</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">{contact.name}</h1>
            <p className="mt-2 text-sm text-slate-400">{contact.company ?? 'No company set'}</p>
            <StatusBadge status={contact.status} kind="contact" className="mt-4" />
          </div>

          <div className="flex gap-3">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setForm({
                      name: contact.name,
                      company: contact.company ?? '',
                      email: contact.email ?? '',
                      phone: contact.phone ?? '',
                      role: contact.role ?? '',
                      workstream_id: contact.workstream_id ?? '',
                      status: contact.status,
                    })
                    setError(null)
                  }}
                  className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {editing ? (
            <>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Email</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Role</span>
                <input
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-300">Workstream</span>
                <select
                  value={form.workstream_id}
                  onChange={(event) =>
                    setForm({ ...form, workstream_id: event.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">None</option>
                  {workstreams.map((workstream) => (
                    <option key={workstream.id} value={workstream.id}>
                      {workstream.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-slate-300">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as ContactStatus,
                    })
                  }
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  {CONTACT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Email</p>
                <p className="mt-2 text-sm text-slate-200">{contact.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Phone</p>
                <p className="mt-2 text-sm text-slate-200">{contact.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Role</p>
                <p className="mt-2 text-sm text-slate-200">{contact.role ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workstream</p>
                <div className="mt-2">
                  {contact.workstream ? (
                    <WorkstreamBadge
                      label={contact.workstream.label}
                      slug={contact.workstream.slug}
                      colour={contact.workstream.colour}
                    />
                  ) : (
                    <p className="text-sm text-slate-200">—</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {sourceEnquiryId ? (
        <div className="rounded-[2rem] border border-sky-500/30 bg-sky-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-200">Converted from enquiry</p>
          <Link
            href={`/enquiries/${sourceEnquiryId}`}
            className="mt-3 inline-flex text-sm font-medium text-white hover:underline"
          >
            View enquiry {sourceEnquiryId}
          </Link>
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Notes</h2>
            <p className="text-sm text-slate-400">Auto-saves when you leave the field.</p>
          </div>
          {notesSaving ? <p className="text-xs text-slate-500">Saving…</p> : null}
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotesOnBlur}
          rows={7}
          className="mt-4 w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
        {notesError ? <p className="mt-3 text-sm text-rose-300">{notesError}</p> : null}
      </div>

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Linked tasks</h2>
            <p className="text-sm text-slate-400">
              Tasks currently tied to this contact.
            </p>
          </div>
          <Link
            href="/tasks"
            className="text-sm text-slate-400 transition hover:text-slate-200"
          >
            Open master tasks
          </Link>
        </div>

        {linkedTasks.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
            No tasks are linked to this contact yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {linkedTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-100">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      Due: {task.due_date ?? 'No due date'}
                    </p>
                  </div>
                  {task.workstream_label ? (
                    <WorkstreamBadge
                      label={task.workstream_label}
                      slug={task.workstream_slug}
                      colour={task.workstream_colour}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
