'use client'

import { useMemo, useState } from 'react'
import type { TouchpointType } from '@/lib/types'

export type PickItem = { id: string; name: string; sub?: string | null }

const TYPES: { value: TouchpointType; label: string }[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Message' },
  { value: 'note', label: 'Note' },
]

/** ISO → value for <input type="datetime-local"> in the viewer's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const field = 'w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]'
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-3)]'

/**
 * Log a calendar event to the CRM as an editable touchpoint linked to an account,
 * contact and/or engagement. Traced back to the event via event_id.
 */
export default function LogToCrmForm({
  event,
  accounts,
  contacts,
  engagements,
  onLogged,
}: {
  event: { id: string; title: string; start_at: string; contact_id: string | null }
  accounts: PickItem[]
  contacts: PickItem[]
  engagements: PickItem[]
  onLogged?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(event.contact_id)
  const [engagementId, setEngagementId] = useState<string>('')
  const [type, setType] = useState<TouchpointType>('meeting')
  const [subject, setSubject] = useState(event.title || '')
  const [occurredAt, setOccurredAt] = useState(toLocalInput(event.start_at))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const hasTarget = !!accountId || !!contactId || !!engagementId

  async function submit() {
    if (!hasTarget) { setError('Pick an account, contact or engagement.'); return }
    if (!subject.trim()) { setError('A subject is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/touchpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          account_id: accountId,
          contact_id: contactId,
          engagement_id: engagementId || null,
          type,
          subject: subject.trim(),
          body: notes.trim() || null,
          occurred_at: occurredAt ? new Date(occurredAt).toISOString() : event.start_at,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to log')
      setDone(true)
      onLogged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
      >
        ＋ Log to CRM
      </button>
    )
  }

  if (done) {
    const acc = accounts.find((a) => a.id === accountId)
    const con = contacts.find((c) => c.id === contactId)
    return (
      <div className="w-full rounded-2xl border border-[color:var(--green)] bg-[var(--green-dim)] px-4 py-3 text-sm text-[color:var(--green-strong)]">
        Logged to CRM ✓{' '}
        {acc ? <a href={`/crm/accounts/${acc.id}`} className="underline">{acc.name}</a> : null}
        {acc && con ? ' · ' : null}
        {con ? <a href={`/crm/contacts/${con.id}`} className="underline">{con.name}</a> : null}
        <button type="button" onClick={() => { setDone(false); setNotes('') }} className="ml-3 text-xs underline">Log another</button>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between">
        <span className={labelCls}>Log to CRM</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-[color:var(--text-3)] hover:text-[color:var(--text)]">Cancel</button>
      </div>
      {error ? <p className="text-xs text-[color:var(--red)]">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SinglePicker label="Account" placeholder="Search accounts…" options={accounts} value={accountId} onChange={setAccountId} />
        <SinglePicker label="Contact" placeholder="Search contacts…" options={contacts} value={contactId} onChange={setContactId} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Engagement</span>
          <select value={engagementId} onChange={(e) => setEngagementId(e.target.value)} className={`${field} mt-1`}>
            <option value="">None</option>
            {engagements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as TouchpointType)} className={`${field} mt-1`}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>When</span>
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={`${field} mt-1`} />
      </label>
      <label className="block">
        <span className={labelCls}>Notes / outcome</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What was agreed, next steps…" className={`${field} mt-1 resize-y`} />
      </label>

      <button
        type="button"
        disabled={saving || !hasTarget}
        onClick={submit}
        className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {saving ? 'Logging…' : 'Log touchpoint'}
      </button>
    </div>
  )
}

function SinglePicker({
  label, placeholder, options, value, onChange,
}: {
  label: string
  placeholder: string
  options: PickItem[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !q || o.name.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [options, query])

  return (
    <div className="block">
      <span className={labelCls}>{label}</span>
      {selected ? (
        <div className="mt-1 flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2">
          <span className="truncate text-sm text-[color:var(--text)]">{selected.name}</span>
          <button type="button" onClick={() => { onChange(null); setQuery('') }} className="text-[color:var(--text-3)] hover:text-[color:var(--red)]" aria-label={`Clear ${label}`}>✕</button>
        </div>
      ) : (
        <div className="relative mt-1">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className={field}
          />
          {open && matches.length > 0 ? (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[var(--surface)] shadow-lg">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(m.id); setOpen(false); setQuery('') }}
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-[var(--surface-2)]"
                >
                  <span className="text-sm text-[color:var(--text)]">{m.name}</span>
                  {m.sub ? <span className="text-[11px] text-[color:var(--text-3)]">{m.sub}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
