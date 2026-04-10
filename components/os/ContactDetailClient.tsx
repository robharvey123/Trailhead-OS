'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import EmailThread from './EmailThread'
import ProjectsSection from './ProjectsSection'
import SearchSelect from './SearchSelect'
import StatusBadge from './StatusBadge'
import TouchpointTimeline from './TouchpointTimeline'
import WorkstreamBadge from './WorkstreamBadge'
import { formatTaskSchedule } from '@/lib/os'
import { calculateTotals } from '@/lib/types'
import type {
  Account,
  Contact,
  ContactStatus,
  ProjectListItem,
  QuoteListItem,
  TaskWithWorkstream,
  Touchpoint,
  Workstream,
} from '@/lib/types'

const CONTACT_STATUSES: ContactStatus[] = ['lead', 'active', 'inactive', 'archived']

type ContactWithRelations = Contact & {
  workstream?: Workstream | null
  account?: Account | null
}

export default function ContactDetailClient({
  initialContact,
  workstreams,
  accounts,
  linkedTasks,
  linkedQuotes,
  sourceEnquiryId,
  initialTouchpoints,
  projects,
}: {
  initialContact: ContactWithRelations
  workstreams: Workstream[]
  accounts: Account[]
  linkedTasks: TaskWithWorkstream[]
  linkedQuotes: QuoteListItem[]
  sourceEnquiryId: string | null
  initialTouchpoints: Touchpoint[]
  projects: ProjectListItem[]
}) {
  const router = useRouter()
  const [contact, setContact] = useState(initialContact)
  const [editing, setEditing] = useState(false)
  const [linkingAccount, setLinkingAccount] = useState(false)
  const [form, setForm] = useState({
    name: initialContact.name,
    company: initialContact.company ?? '',
    email: initialContact.email ?? '',
    phone: initialContact.phone ?? '',
    role: initialContact.role ?? '',
    address_line1: initialContact.address_line1 ?? '',
    address_line2: initialContact.address_line2 ?? '',
    city: initialContact.city ?? '',
    postcode: initialContact.postcode ?? '',
    country: initialContact.country ?? 'UK',
    workstream_id: initialContact.workstream_id ?? '',
    account_id: initialContact.account_id ?? '',
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
          address_line1: form.address_line1,
          address_line2: form.address_line2,
          city: form.city,
          postcode: form.postcode,
          country: form.country,
          workstream_id: form.workstream_id || null,
          account_id: form.account_id || null,
          status: form.status,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save contact')
      }

      const updatedContact = data.contact as Contact
      setContact({
        ...updatedContact,
        workstream: workstreams.find((item) => item.id === updatedContact.workstream_id) ?? null,
        account: accounts.find((item) => item.id === updatedContact.account_id) ?? null,
      })
      setEditing(false)
      setLinkingAccount(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save contact')
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
    } catch (saveError) {
      setNotesError(saveError instanceof Error ? saveError.message : 'Failed to save notes')
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white0">Contact</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{contact.name}</h1>
            <p className="mt-2 text-sm text-[#9CA3AF]">{contact.company ?? 'No company set'}</p>
            <StatusBadge status={contact.status} kind="contact" className="mt-4" />
          </div>

          <div className="flex gap-3">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setLinkingAccount(false)
                    setForm({
                      name: contact.name,
                      company: contact.company ?? '',
                      email: contact.email ?? '',
                      phone: contact.phone ?? '',
                      role: contact.role ?? '',
                      address_line1: contact.address_line1 ?? '',
                      address_line2: contact.address_line2 ?? '',
                      city: contact.city ?? '',
                      postcode: contact.postcode ?? '',
                      country: contact.country ?? 'UK',
                      workstream_id: contact.workstream_id ?? '',
                      account_id: contact.account_id ?? '',
                      status: contact.status,
                    })
                    setError(null)
                  }}
                  className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
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
                <span className="text-sm text-[#9CA3AF]">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Email</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Role</span>
                <input
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[#9CA3AF]">Address line 1</span>
                <input
                  value={form.address_line1}
                  onChange={(event) => setForm({ ...form, address_line1: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[#9CA3AF]">Address line 2</span>
                <input
                  value={form.address_line2}
                  onChange={(event) => setForm({ ...form, address_line2: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">City</span>
                <input
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Postcode</span>
                <input
                  value={form.postcode}
                  onChange={(event) => setForm({ ...form, postcode: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[#9CA3AF]">Country</span>
                <input
                  value={form.country}
                  onChange={(event) => setForm({ ...form, country: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[#9CA3AF]">Workstream</span>
                <select
                  value={form.workstream_id}
                  onChange={(event) => setForm({ ...form, workstream_id: event.target.value })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
                >
                  <option value="">None</option>
                  {workstreams.map((workstream) => (
                    <option key={workstream.id} value={workstream.id}>
                      {workstream.label}
                    </option>
                  ))}
                </select>
              </label>
              <SearchSelect
                label="Account"
                value={form.account_id}
                options={accounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                  meta: account.website ?? account.industry ?? null,
                }))}
                onChange={(value) => setForm({ ...form, account_id: value })}
                placeholder="Search accounts"
                emptyLabel="No account"
              />
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[#9CA3AF]">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as ContactStatus })}
                  className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
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
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Email</p>
                <p className="mt-2 text-sm text-[#9CA3AF]">{contact.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Phone</p>
                <p className="mt-2 text-sm text-[#9CA3AF]">{contact.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Role</p>
                <p className="mt-2 text-sm text-[#9CA3AF]">{contact.role ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Address</p>
                <div className="mt-2 whitespace-pre-wrap text-sm text-[#9CA3AF]">
                  {[
                    contact.address_line1,
                    contact.address_line2,
                    contact.city,
                    contact.postcode,
                    contact.country,
                  ]
                    .filter(Boolean)
                    .join('\n') || '—'}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Account</p>
                <div className="mt-2">
                  {contact.account ? (
                    <Link
                      href={`/crm/accounts/${contact.account.id}`}
                      className="text-sm text-sky-300 transition hover:text-sky-200"
                    >
                      {contact.account.name}
                    </Link>
                  ) : linkingAccount ? (
                    <div className="space-y-3">
                      <SearchSelect
                        label=""
                        value={form.account_id}
                        options={accounts.map((account) => ({
                          value: account.id,
                          label: account.name,
                          meta: account.website ?? account.industry ?? null,
                        }))}
                        onChange={(value) => setForm({ ...form, account_id: value })}
                        placeholder="Search accounts"
                        emptyLabel="No account"
                      />
                      <button
                        type="button"
                        onClick={saveChanges}
                        disabled={saving || !form.account_id}
                        className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-white transition hover:border-[#B8FF00]/40 disabled:opacity-60"
                      >
                        Link account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-[#9CA3AF]">No account</p>
                      <button
                        type="button"
                        onClick={() => setLinkingAccount(true)}
                        className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
                      >
                        Link to account
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white0">Workstream</p>
                <div className="mt-2">
                  {contact.workstream ? (
                    <WorkstreamBadge
                      label={contact.workstream.label}
                      slug={contact.workstream.slug}
                      colour={contact.workstream.colour}
                    />
                  ) : (
                    <p className="text-sm text-[#9CA3AF]">—</p>
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

      <ProjectsSection
        title="Projects"
        description="Projects this contact is actively involved in."
        projects={projects}
        emptyMessage="No projects linked to this contact yet."
      />

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Quotes</h2>
            <p className="text-sm text-[#9CA3AF]">Proposals linked to this contact.</p>
          </div>
          <Link
            href={contact.account_id ? `/quotes/new?account_id=${contact.account_id}` : '/quotes/new'}
            className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
          >
            New quote
          </Link>
        </div>

        {linkedQuotes.length ? (
          <div className="mt-4 space-y-3">
            {linkedQuotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="block rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4 transition hover:border-[#2A2A3A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{quote.quote_number}</p>
                    <p className="mt-1 text-sm text-[#9CA3AF]">{quote.title}</p>
                    <p className="mt-2 text-xs text-white0">{quote.issue_date}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={quote.status} kind="quote" />
                    <p className="mt-2 text-sm font-medium text-white">
                      £{calculateTotals(quote.line_items, quote.vat_rate).total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-8 text-sm text-white0">
            No quotes linked to this contact yet.
          </div>
        )}
      </div>

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Notes</h2>
            <p className="text-sm text-[#9CA3AF]">Auto-saves when you leave the field.</p>
          </div>
          {notesSaving ? <p className="text-xs text-white0">Saving…</p> : null}
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotesOnBlur}
          rows={7}
          className="mt-4 w-full rounded-[1.5rem] border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
        />
        {notesError ? <p className="mt-3 text-sm text-rose-300">{notesError}</p> : null}
      </div>

      <TouchpointTimeline
        initialTouchpoints={initialTouchpoints}
        accountId={contact.account_id}
        contactId={contact.id}
        title="Touchpoints"
        description="Log calls, emails, messages, meetings, and notes for this contact."
      />

      <EmailThread
        title="Emails"
        contact_id={contact.id}
        contact_email={contact.email}
        account_id={contact.account_id}
      />

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Linked tasks</h2>
            <p className="text-sm text-[#9CA3AF]">Tasks currently tied to this contact.</p>
          </div>
          <Link href="/tasks" className="text-sm text-[#9CA3AF] transition hover:text-[#9CA3AF]">
            Open master tasks
          </Link>
        </div>

        {linkedTasks.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-8 text-sm text-white0">
            No tasks are linked to this contact yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {linkedTasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{task.title}</p>
                    <p className="mt-1 text-sm text-[#9CA3AF]">
                      Due: {formatTaskSchedule(task.due_date, task.due_time)}
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
