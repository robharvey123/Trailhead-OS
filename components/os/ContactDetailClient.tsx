'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import EmailThread from './EmailThread'
import ProjectsSection from './ProjectsSection'
import SearchSelect from './SearchSelect'
import StatusBadge from './StatusBadge'
import TouchpointTimeline from './TouchpointTimeline'
import MeetingNotesTimeline from './MeetingNotesTimeline'
import MeetingsTimeline from './MeetingsTimeline'
import WorkstreamBadge from './WorkstreamBadge'
import type { MeetingNoteWithRelations } from '@/lib/db/meeting-notes'
import type { MeetingWithRelations } from '@/lib/db/meetings'
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
  meetingNotes,
  meetings = [],
  projects,
}: {
  initialContact: ContactWithRelations
  workstreams: Workstream[]
  accounts: Account[]
  linkedTasks: TaskWithWorkstream[]
  linkedQuotes: QuoteListItem[]
  sourceEnquiryId: string | null
  initialTouchpoints: Touchpoint[]
  meetingNotes: MeetingNoteWithRelations[]
  meetings?: MeetingWithRelations[]
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
    channel: initialContact.channel ?? '',
    website: initialContact.website ?? '',
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
          channel: form.channel,
          website: form.website,
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
      <div className="os-card rounded-[2rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="os-eyebrow">Contact</p>
            <h1 className="os-page-title mt-2">{contact.name}</h1>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">{contact.company ?? 'No company set'}</p>
            <StatusBadge status={contact.status} kind="contact" className="mt-4" />
          </div>

          <div className="flex gap-3">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={saving}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
                      channel: contact.channel ?? '',
                      website: contact.website ?? '',
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
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {editing ? (
            <>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Email</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Role</span>
                <input
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Channel</span>
                <input
                  value={form.channel}
                  onChange={(event) => setForm({ ...form, channel: event.target.value })}
                  placeholder="e.g. Online Pouch Retailers"
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Website</span>
                <input
                  value={form.website}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  placeholder="e.g. example.com"
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[color:var(--text-2)]">Address line 1</span>
                <input
                  value={form.address_line1}
                  onChange={(event) => setForm({ ...form, address_line1: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[color:var(--text-2)]">Address line 2</span>
                <input
                  value={form.address_line2}
                  onChange={(event) => setForm({ ...form, address_line2: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">City</span>
                <input
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Postcode</span>
                <input
                  value={form.postcode}
                  onChange={(event) => setForm({ ...form, postcode: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm text-[color:var(--text-2)]">Country</span>
                <input
                  value={form.country}
                  onChange={(event) => setForm({ ...form, country: event.target.value })}
                  className="os-input w-full rounded-2xl px-4 py-3 text-sm"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Workstream</span>
                <select
                  value={form.workstream_id}
                  onChange={(event) => setForm({ ...form, workstream_id: event.target.value })}
                  className="os-select w-full rounded-2xl px-4 py-3 text-sm"
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
                <span className="text-sm text-[color:var(--text-2)]">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as ContactStatus })}
                  className="os-select w-full rounded-2xl px-4 py-3 text-sm"
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
                <p className="os-eyebrow">Email</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{contact.email ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">Phone</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{contact.phone ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">Role</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{contact.role ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">Channel</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{contact.channel ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">Website</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">
                  {contact.website ? (
                    <a
                      href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--accent-strong)] hover:text-[color:var(--accent-hover)]"
                    >
                      {contact.website}
                    </a>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="os-eyebrow">Address</p>
                <div className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">
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
                <p className="os-eyebrow">Account</p>
                <div className="mt-2">
                  {contact.account ? (
                    <Link
                      href={`/crm/accounts/${contact.account.id}`}
                      className="text-sm text-[color:var(--accent-strong)] transition hover:text-[color:var(--accent-hover)]"
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
                        className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text)] transition hover:border-[color:var(--accent-strong)] disabled:opacity-60"
                      >
                        Link account
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-[color:var(--text-2)]">No account</p>
                      <button
                        type="button"
                        onClick={() => setLinkingAccount(true)}
                        className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
                      >
                        Link to account
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="os-eyebrow">Workstream</p>
                <div className="mt-2">
                  {contact.workstream ? (
                    <WorkstreamBadge
                      label={contact.workstream.label}
                      slug={contact.workstream.slug}
                      colour={contact.workstream.colour}
                    />
                  ) : (
                    <p className="text-sm text-[color:var(--text-2)]">—</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {sourceEnquiryId ? (
        <div className="rounded-[2rem] border border-[color:var(--accent)] bg-[var(--accent-dim)] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">Converted from enquiry</p>
          <Link
            href={`/enquiries/${sourceEnquiryId}`}
            className="mt-3 inline-flex text-sm font-medium text-[color:var(--accent-strong)] hover:underline"
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

      <div className="os-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text)]">Quotes</h2>
            <p className="text-sm text-[color:var(--text-2)]">Proposals linked to this contact.</p>
          </div>
          <Link
            href={contact.account_id ? `/quotes/new?account_id=${contact.account_id}` : '/quotes/new'}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
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
                className="block rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4 transition hover:border-[color:var(--accent-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--text)]">{quote.quote_number}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">{quote.title}</p>
                    <p className="mt-2 text-xs text-[color:var(--text-3)]">{quote.issue_date}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={quote.status} kind="quote" />
                    <p className="mt-2 text-sm font-medium text-[color:var(--text)]">
                      £{calculateTotals(quote.line_items, quote.vat_rate).total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--text-3)]">
            No quotes linked to this contact yet.
          </div>
        )}
      </div>

      <div className="os-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text)]">Notes</h2>
            <p className="text-sm text-[color:var(--text-2)]">Auto-saves when you leave the field.</p>
          </div>
          {notesSaving ? <p className="text-xs text-[color:var(--text-3)]">Saving…</p> : null}
        </div>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={saveNotesOnBlur}
          rows={7}
          className="os-textarea mt-4 w-full rounded-[1.5rem] px-4 py-3 text-sm"
        />
        {notesError ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{notesError}</p> : null}
      </div>

      <TouchpointTimeline
        initialTouchpoints={initialTouchpoints}
        accountId={contact.account_id}
        contactId={contact.id}
        title="Touchpoints"
        description="Log calls, emails, messages, meetings, and notes for this contact."
      />

      <MeetingNotesTimeline notes={meetingNotes} />
      <MeetingsTimeline meetings={meetings} />

      <EmailThread
        title="Emails"
        contact_id={contact.id}
        contact_email={contact.email}
        account_id={contact.account_id}
      />

      <div className="os-card rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--text)]">Linked tasks</h2>
            <p className="text-sm text-[color:var(--text-2)]">Tasks currently tied to this contact.</p>
          </div>
          <Link href="/tasks" className="text-sm text-[color:var(--text-2)] transition hover:text-[color:var(--text)]">
            Open master tasks
          </Link>
        </div>

        {linkedTasks.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--text-3)]">
            No tasks are linked to this contact yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {linkedTasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[color:var(--text)]">{task.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">
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
