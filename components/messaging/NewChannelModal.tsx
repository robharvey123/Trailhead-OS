'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createChannel } from '@/app/(os)/messages/actions'

type DirectoryUser = { id: string; name: string }

export default function NewChannelModal({ users, onClose }: { users: DirectoryUser[]; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const filtered = users.filter((u) => u.name.toLowerCase().includes(query.trim().toLowerCase()))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!name.trim()) { setError('Give the channel a name.'); return }
    if (selected.size === 0) { setError('Add at least one other member.'); return }
    setBusy(true); setError('')
    const res = await createChannel({ name: name.trim(), memberUserIds: [...selected] })
    if (res.error || !res.id) { setError(res.error || 'Could not create the channel.'); setBusy(false); return }
    router.push(`/messages/${res.id}`)
  }

  const input = 'w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/45" onClick={() => !busy && onClose()}>
      <div className="panel grid w-[min(440px,92vw)] gap-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="panel-section-title m-0!">New channel</div>
        <div>
          <label className="field-label">Name</label>
          <input className={input} value={name} maxLength={100} placeholder="e.g. brand-sales" onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="field-label">Members{selected.size ? ` (${selected.size})` : ''}</label>
          <input className={`${input} mt-1`} placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="mt-1.5 grid max-h-[240px] gap-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-1 py-1.5 text-[13px] text-[var(--text-3)]">No people found.</p>
            ) : (
              filtered.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-[var(--surface-3)] text-[11px] text-[var(--text-2)]">{u.name.slice(0, 2).toUpperCase()}</span>
                  <span>{u.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
        {error ? <p className="m-0 text-xs text-[var(--red-strong)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create channel'}</button>
        </div>
      </div>
    </div>
  )
}
