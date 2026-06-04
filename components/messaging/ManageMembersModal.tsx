'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addParticipants, removeParticipant, leaveConversation } from '@/app/(os)/messages/actions'

export type Member = { userId: string; name: string; role: string; joinedAt: string }
type DirectoryUser = { id: string; name: string }

export default function ManageMembersModal({
  conversationId,
  members,
  users,
  isAdmin,
  meId,
  onClose,
}: {
  conversationId: string
  members: Member[]
  users: DirectoryUser[]
  isAdmin: boolean
  meId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  const input = 'w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => !busy && onClose()}>
      <div className="panel" style={{ width: 'min(440px, 92vw)', padding: 20, display: 'grid', gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-section-title" style={{ margin: 0 }}>Members</div>

        {adding ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <input className={input} placeholder="Search people…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div style={{ display: 'grid', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
              {addable.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n })} />
                  <span>{u.name}</span>
                </label>
              ))}
              {addable.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '6px 4px' }}>Nobody left to add.</p> : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setSelected(new Set()) }} disabled={busy}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={busy || selected.size === 0} onClick={() => run(() => addParticipants(conversationId, [...selected]))}>Add {selected.size || ''}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--surface-3)] text-[11px] text-[var(--text-2)]">{m.name.slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{m.name}{m.userId === meId ? ' (you)' : ''}</span>
                  {m.role === 'admin' ? <span className="channel-tag">admin</span> : null}
                  {isAdmin && m.userId !== meId ? (
                    <button className="text-xs text-[var(--red-strong)] hover:opacity-80" disabled={busy} onClick={() => run(() => removeParticipant(conversationId, m.userId))}>Remove</button>
                  ) : null}
                </div>
              ))}
            </div>
            {error ? <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-strong)' }} disabled={busy} onClick={() => run(() => leaveConversation(conversationId), true)}>Leave channel</button>
              <div style={{ display: 'flex', gap: 8 }}>
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
