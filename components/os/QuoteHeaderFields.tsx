'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { QuoteListItem } from '@/lib/types'

export interface QuoteFieldOptions {
  accounts: { id: string; name: string }[]
  contacts: { id: string; name: string; account_id: string | null; company: string | null }[]
  projects: { id: string; name: string }[]
}

type FieldKey = 'account' | 'contact' | 'project' | 'issue_date' | 'valid_until'

const EDITABLE_STATUSES = new Set(['draft', 'review', 'sent'])

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`)
  )
}

function Pencil() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60 group-focus-visible:opacity-60">
      <path d="M11 2.5l2.5 2.5L6 12.5H3.5V10L11 2.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

interface FieldProps {
  label: string
  display: React.ReactNode
  editable: boolean
  isEditing: boolean
  onStart: () => void
  error: string | null
  children: React.ReactNode
}

/** One header field: the value, or (while editing) the control passed as children. */
function Field({ label, display, editable, isEditing, onStart, error, children }: FieldProps) {
  return (
    <div>
      <p className="os-eyebrow">{label}</p>
      <div className="mt-2 min-h-9 text-sm text-[color:var(--text-2)]">
        {isEditing ? (
          children
        ) : editable ? (
          <button
            type="button"
            onClick={onStart}
            aria-label={`Edit ${label.toLowerCase()}`}
            className={`group -mx-2 inline-flex max-w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-left hover:bg-[var(--surface-2)] ${focusRing}`}
          >
            <span className="truncate">{display}</span>
            <Pencil />
          </button>
        ) : (
          <span className="inline-block py-1">{display}</span>
        )}
        {error ? (
          <p role="alert" className="mt-1 text-xs text-[color:var(--red-strong)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** A select that saves as soon as a value is picked. Escape or leaving it cancels. */
function InlineSelect({
  value,
  saving,
  onPick,
  onCancel,
  children,
}: {
  value: string
  saving: boolean
  onPick: (value: string) => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <select
        autoFocus
        defaultValue={value}
        disabled={saving}
        onChange={(e) => onPick(e.target.value)}
        onBlur={() => !saving && onCancel()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        className="os-select w-full max-w-xs px-3 py-2 text-sm disabled:opacity-60"
      >
        {children}
      </select>
      {saving ? <span className="text-xs text-[color:var(--text-3)]">Saving…</span> : null}
    </div>
  )
}

/**
 * A date with explicit Save/Cancel. Saving on every change would fire for each
 * digit typed into the year (0002, 0020, 0202, 2026 are all valid dates).
 */
function InlineDate({
  value,
  min,
  required,
  saving,
  onSave,
  onCancel,
}: {
  value: string
  min?: string
  required: boolean
  saving: boolean
  onSave: (value: string | null) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const submit = () => {
    if (required && !draft) return
    onSave(draft || null)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        autoFocus
        type="date"
        value={draft}
        min={min}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        className="os-input px-3 py-2 text-sm"
      />
      <button type="button" onClick={submit} disabled={saving || (required && !draft)} className="btn btn-primary btn-sm">
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost btn-sm">
        Cancel
      </button>
    </div>
  )
}

/**
 * The quote detail header (account, contact, project, enquiry, dates), each
 * editable in place for draft, review and sent quotes. Saves go through
 * PATCH /api/quotes/[id]; the page then refreshes so the Client page panel's
 * publish checks update. Accepted and converted quotes stay read-only, as the
 * edit page does. The enquiry link is display only.
 */
export default function QuoteHeaderFields({
  quote,
  options,
  onSaved,
}: {
  quote: QuoteListItem
  options: QuoteFieldOptions
  onSaved: (quote: QuoteListItem) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<FieldKey | null>(null)
  const [saving, setSaving] = useState<FieldKey | null>(null)
  const [error, setError] = useState<{ field: FieldKey; message: string } | null>(null)
  const editable = EDITABLE_STATUSES.has(quote.status)

  async function save(field: FieldKey, patch: Record<string, unknown>) {
    setSaving(field)
    setError(null)
    try {
      const data = await apiFetch<{ quote: QuoteListItem }>(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      onSaved(data.quote)
      setEditing(null)
      router.refresh()
    } catch (err) {
      setError({ field, message: err instanceof Error ? err.message : 'Could not save' })
    } finally {
      setSaving(null)
    }
  }

  function start(field: FieldKey) {
    setError(null)
    setEditing(field)
  }
  const cancel = () => setEditing(null)
  const fieldProps = (field: FieldKey) => ({
    editable,
    isEditing: editing === field,
    onStart: () => start(field),
    error: error?.field === field ? error.message : null,
  })

  function pickAccount(value: string) {
    const accountId = value || null
    const patch: Record<string, unknown> = { account_id: accountId }
    // A contact from a different account no longer belongs on this quote.
    const contact = options.contacts.find((c) => c.id === quote.contact_id)
    if (contact && accountId && contact.account_id && contact.account_id !== accountId) patch.contact_id = null
    void save('account', patch)
  }

  function pickContact(value: string) {
    const contactId = value || null
    const patch: Record<string, unknown> = { contact_id: contactId }
    // A contact chosen on a quote with no account brings its account with it.
    const contact = options.contacts.find((c) => c.id === contactId)
    if (!quote.account_id && contact?.account_id) patch.account_id = contact.account_id
    void save('contact', patch)
  }

  const contactsForAccount = quote.account_id
    ? options.contacts.filter((c) => c.account_id === quote.account_id || c.id === quote.contact_id)
    : options.contacts

  const blank = <span className="text-[color:var(--text-3)]">{editable ? 'Add' : '—'}</span>

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Account" display={quote.account?.name ?? blank} {...fieldProps('account')}>
        <InlineSelect value={quote.account_id ?? ''} saving={saving === 'account'} onPick={pickAccount} onCancel={cancel}>
          <option value="">No account</option>
          {options.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </InlineSelect>
      </Field>

      <Field label="Contact" display={quote.contact?.name ?? blank} {...fieldProps('contact')}>
        <InlineSelect value={quote.contact_id ?? ''} saving={saving === 'contact'} onPick={pickContact} onCancel={cancel}>
          <option value="">No contact</option>
          {contactsForAccount.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {!quote.account_id && c.company ? ` (${c.company})` : ''}
            </option>
          ))}
        </InlineSelect>
        {quote.account_id && contactsForAccount.length === 0 ? (
          <p className="mt-1 text-xs text-[color:var(--text-3)]">No contacts on this account yet.</p>
        ) : null}
      </Field>

      <Field label="Project" display={quote.project?.name ?? blank} {...fieldProps('project')}>
        <InlineSelect
          value={quote.project_id ?? ''}
          saving={saving === 'project'}
          onPick={(value) => void save('project', { project_id: value || null })}
          onCancel={cancel}
        >
          <option value="">No project</option>
          {options.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </InlineSelect>
      </Field>

      <div>
        <p className="os-eyebrow">Enquiry</p>
        <p className="mt-2 min-h-9 py-1 text-sm text-[color:var(--text-2)]">
          {quote.enquiry ? (
            <Link href={`/enquiries/${quote.enquiry.id}`} className="text-[color:var(--accent-strong)] transition hover:text-[color:var(--accent-hover)]">
              {quote.enquiry.biz_name}
            </Link>
          ) : (
            '—'
          )}
        </p>
      </div>

      <Field label="Issue date" display={formatDate(quote.issue_date)} {...fieldProps('issue_date')}>
        <InlineDate
          value={quote.issue_date?.slice(0, 10) ?? ''}
          required
          saving={saving === 'issue_date'}
          onSave={(value) => void save('issue_date', { issue_date: value })}
          onCancel={cancel}
        />
      </Field>

      <Field label="Valid until" display={quote.valid_until ? formatDate(quote.valid_until) : blank} {...fieldProps('valid_until')}>
        <InlineDate
          value={quote.valid_until?.slice(0, 10) ?? ''}
          min={quote.issue_date?.slice(0, 10)}
          required={false}
          saving={saving === 'valid_until'}
          onSave={(value) => void save('valid_until', { valid_until: value })}
          onCancel={cancel}
        />
      </Field>
    </div>
  )
}
