'use client'

import { useState, useTransition } from 'react'
import { addContactNote, markContactUnsubscribed } from './actions'

export default function ContactActions({ contactId, unsubscribed }: { contactId: string; unsubscribed: boolean }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, after?: () => void) {
    setError(null)
    setSaved(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSaved(done)
      after?.()
    })
  }

  return (
    <div className="space-y-3">
      <label className="block text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]" htmlFor="sales-note">
        Add a note
      </label>
      <textarea
        id="sales-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        placeholder="What did they say?"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending || !note.trim()}
          onClick={() => run(() => addContactNote(contactId, note), 'Note saved.', () => setNote(''))}
        >
          Save note
        </button>
        {unsubscribed ? null : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm('Mark this contact unsubscribed? They will get no more campaign emails and drop out of calling.')) {
                run(() => markContactUnsubscribed(contactId), 'Marked unsubscribed.')
              }
            }}
          >
            Mark unsubscribed
          </button>
        )}
        <span role="status" className="text-xs">
          {error ? <span className="text-[color:var(--red)]">{error}</span> : saved ? <span className="text-[color:var(--text-2)]">{saved}</span> : null}
        </span>
      </div>
    </div>
  )
}
