'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDirectMessage } from '@/app/(os)/messages/actions'

type DirectoryUser = { id: string; name: string }

export default function StartConversationModal({
  users,
  onClose,
}: {
  users: DirectoryUser[]
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function pick(userId: string) {
    setBusy(true)
    setError('')
    const res = await createDirectMessage(userId)
    if (res.error || !res.id) {
      setError(res.error || 'Could not start the conversation.')
      setBusy(false)
      return
    }
    router.push(`/messages/${res.id}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/45"
      onClick={() => !busy && onClose()}
    >
      <div className="panel grid w-[min(420px,92vw)] gap-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="panel-section-title m-0!">Start a conversation</div>
        <input
          autoFocus
          className="w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid max-h-[320px] gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-[var(--text-3)]">No people found.</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={busy}
                onClick={() => pick(u.id)}
                className="flex items-center gap-3 rounded-control px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-[var(--surface-3)] text-[11px] text-[var(--text-2)]">
                  {u.name.slice(0, 2).toUpperCase()}
                </span>
                <span>{u.name}</span>
              </button>
            ))
          )}
        </div>
        {error ? <p className="m-0 text-xs text-[var(--red-strong)]">{error}</p> : null}
        <div className="flex justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
