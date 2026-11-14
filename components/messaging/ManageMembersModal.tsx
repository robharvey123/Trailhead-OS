'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addParticipants, removeParticipant, leaveConversation, setConversationDefaultEngagement } from '@/app/(os)/messages/actions'

export type Member = { userId: string; name: string; role: string; joinedAt: string }
type DirectoryUser = { id: string; name: string }

export default function ManageMembersModal({
  conversationId,
  members,
  users,
  isAdmin,
  meId,
  engagements,
  defaultEngagementId,
  onClose,
}: {
  conversationId: string
  members: Member[]
  users: DirectoryUser[]
  isAdmin: boolean
  meId: string
  engagements: Array<{ id: string; name: string }>
  defaultEngagementId: string | null
  onClose: () => void
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [engagementId, setEngagementId] = useState(defaultEngagementId ?? '')

  async function saveEngagement(next: string) {
    setEngagementId(next)
    setBusy(true); setError('')
    const res = await setConversationDefaultEngagement(conversationId, next || null)
    if (res.error) setError(res.error)
    else router.refresh()
    setBusy(false)
  }

  const memberIds = new Set(members.map((m) => m.userId))
  const addable = users.filter((u) => !memberIds.has(u.id) && u.name.toLowerCase().includes(query.trim().toLowerCase()))

  async function run(fn: () => Promise<{ error?: string }>, afterLeave = false) {
    setBusy(true); setError('')
    const res = await fn()
    if (res.error) { setError(res.error); setBusy(false); return }
    if (afterLeave) { router.push('/messages'); return }
    router.refresh()
    setBusy(false)
    setAdding(false); setSelected(new Set()); setQuery('')
  }

  const input = 'w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/45" onClick={() => !busy && onClose()}>
      <div className="panel grid w-[min(440px,92vw)] gap-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="panel-section-title m-0!">Members</div>

        {adding ? (
          <div className="grid gap-1.5">
            <input className={input} placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div className="grid max-h-[200px] gap-0.5 overflow-y-auto">
              {addable.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n })} />
                  <span>{u.name}</span>
                </label>
              ))}
              {addable.length === 0 ? <p className="px-1 py-1.5 text-[13px] text-[var(--text-3)]">Nobody left to add.</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setSelected(new Set()) }} disabled={busy}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy || selected.size === 0} onClick={() => run(() => addParticipants(conversationId, [...selected]))}>Add {selected.size || ''}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid max-h-[280px] gap-0.5 overflow-y-auto">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 rounded-control px-3 py-2 text-sm">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-[var(--surface-3)] text-[11px] text-[var(--text-2)]">{m.name.slice(0, 2).toUpperCase()}</span>
                  <span className="flex-1 text-[var(--text)]">{m.name}{m.userId === meId ? ' (you)' : ''}</span>
                  {m.role === 'admin' ? <span className="channel-tag">admin</span> : null}
                  {isAdmin && m.userId !== meId ? (
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => removeParticipant(conversationId, m.userId))}>Remove</button>
                  ) : null}
                </div>
              ))}
            </div>
            {isAdmin ? (
              <div className="grid gap-1 border-t border-[var(--border)] pt-2.5">
                <label className="field-label">
                  Default engagement
                </label>
                <select
                  className={input}
                  value={engagementId}
                  disabled={busy}
                  onChange={(e) => saveEngagement(e.target.value)}
                >
                  <option value="">— none</option>
                  {engagements.map((en) => (<option key={en.id} value={en.id}>{en.name}</option>))}
                </select>
                <p className="m-0 text-[11px] text-[var(--text-3)]">
                  Pre-selected when converting a message here into a task.
                </p>
              </div>
            ) : null}
            {error ? <p className="m-0 text-xs text-[var(--red-strong)]">{error}</p> : null}
            <div className="flex justify-between gap-2">
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(() => leaveConversation(conversationId), true)}>Leave channel</button>
              <div className="flex gap-2">
                {isAdmin ? <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)} disabled={busy}>Add members</button> : null}
                <button className="btn btn-primary btn-sm" onClick={onClose} disabled={busy}>Done</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
