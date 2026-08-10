'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addMeetingAccount, removeMeetingAccount, addMeetingContact, removeMeetingContact,
} from '@/app/(os)/crm/meetings/actions'

export type LinkItem = { id: string; name: string; sub?: string | null }

export default function MeetingLinksEditor({
  meetingId,
  initialAccounts,
  initialContacts,
  allAccounts,
  allContacts,
}: {
  meetingId: string
  initialAccounts: LinkItem[]
  initialContacts: LinkItem[]
  allAccounts: LinkItem[]
  allContacts: LinkItem[]
}) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<LinkItem[]>(initialAccounts)
  const [contacts, setContacts] = useState<LinkItem[]>(initialContacts)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()

  function run(fn: () => Promise<{ error?: string }>, revert: () => void) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res?.error) { setError(res.error); revert() }
      else router.refresh()
    })
  }

  function addAccount(item: LinkItem) {
    if (accounts.some((a) => a.id === item.id)) return
    setAccounts((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))
    run(() => addMeetingAccount(meetingId, item.id), () => setAccounts((p) => p.filter((a) => a.id !== item.id)))
  }
  function removeAccount(item: LinkItem) {
    setAccounts((p) => p.filter((a) => a.id !== item.id))
    run(() => removeMeetingAccount(meetingId, item.id), () => setAccounts((p) => [...p, item]))
  }
  function addContact(item: LinkItem) {
    if (contacts.some((c) => c.id === item.id)) return
    setContacts((p) => [...p, item].sort((a, b) => a.name.localeCompare(b.name)))
    run(() => addMeetingContact(meetingId, item.id), () => setContacts((p) => p.filter((c) => c.id !== item.id)))
  }
  function removeContact(item: LinkItem) {
    setContacts((p) => p.filter((c) => c.id !== item.id))
    run(() => removeMeetingContact(meetingId, item.id), () => setContacts((p) => [...p, item]))
  }

  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text)]">Linked records</h2>
      {error ? <p className="mt-2 text-xs text-[color:var(--red)]">{error}</p> : null}

      <LinkSection
        label="Accounts"
        linked={accounts}
        options={allAccounts}
        onAdd={addAccount}
        onRemove={removeAccount}
        placeholder="Link an account…"
        hrefBase="/crm/accounts"
      />
      <LinkSection
        label="Contacts"
        linked={contacts}
        options={allContacts}
        onAdd={addContact}
        onRemove={removeContact}
        placeholder="Link a contact…"
        hrefBase="/crm/contacts"
      />
    </div>
  )
}

function LinkSection({
  label, linked, options, onAdd, onRemove, placeholder, hrefBase,
}: {
  label: string
  linked: LinkItem[]
  options: LinkItem[]
  onAdd: (item: LinkItem) => void
  onRemove: (item: LinkItem) => void
  placeholder: string
  hrefBase: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const linkedIds = useMemo(() => new Set(linked.map((l) => l.id)), [linked])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !linkedIds.has(o.id))
      .filter((o) => !q || o.name.toLowerCase().includes(q) || (o.sub ?? '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [options, linkedIds, query])

  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {linked.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[color:var(--text)]">
            <a href={`${hrefBase}/${item.id}`} className="hover:text-[color:var(--accent)]" title={item.sub ?? item.name}>{item.name}</a>
            <button type="button" onClick={() => onRemove(item)} className="text-[var(--muted)] transition hover:text-[color:var(--red)]" aria-label={`Unlink ${item.name}`}>✕</button>
          </span>
        ))}
        {linked.length === 0 ? <span className="text-xs text-[var(--muted)]">None linked yet.</span> : null}
      </div>

      <div ref={boxRef} className="relative mt-2 max-w-sm">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
        />
        {open && matches.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onAdd(m); setQuery(''); setOpen(false) }}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-[var(--surface-2)]"
              >
                <span className="text-sm text-[color:var(--text)]">{m.name}</span>
                {m.sub ? <span className="text-[11px] text-[var(--muted)]">{m.sub}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
