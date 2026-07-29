'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'

export type MergeTarget = { id: string; name: string }
export type MergeRequest = { type: 'contact' | 'account'; a: MergeTarget; b: MergeTarget }

interface MergeDialogProps {
  request: MergeRequest
  onClose: () => void
  onMerged: (loserId: string) => void
}

/** Pick which of two duplicates to keep; the other is archived and its references repointed. */
export default function MergeDialog({ request, onClose, onMerged }: MergeDialogProps) {
  const { type, a, b } = request
  const [winnerId, setWinnerId] = useState<string>(a.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loser = winnerId === a.id ? b : a
  const winner = winnerId === a.id ? a : b

  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/crm/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, winner_id: winner.id, loser_id: loser.id }),
      })
      onMerged(loser.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div className="os-card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-[color:var(--text)]">Merge {type}s</h2>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Keep one record. The other is archived and everything pointing at it — tasks, meetings,
          touchpoints, threads — moves to the one you keep. This can’t be undone from the UI.
        </p>

        <div className="mt-4 space-y-2">
          {[a, b].map((opt) => (
            <label
              key={opt.id}
              className="card flex cursor-pointer items-center gap-3"
              style={{ borderColor: winnerId === opt.id ? 'var(--accent)' : undefined }}
            >
              <input type="radio" name="winner" checked={winnerId === opt.id} onChange={() => setWinnerId(opt.id)} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[color:var(--text)]">{opt.name}</div>
                <div className="td-mono text-xs" style={{ color: 'var(--text-3)' }}>
                  {winnerId === opt.id ? 'keep' : 'archive'}
                </div>
              </div>
            </label>
          ))}
        </div>

        {error ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Merging…' : `Merge into “${winner.name}”`}
          </button>
        </div>
      </div>
    </div>
  )
}
