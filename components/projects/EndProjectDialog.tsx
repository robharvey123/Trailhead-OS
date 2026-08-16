'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { endProject } from '@/app/(os)/projects/records/[id]/actions'
import Modal from '@/components/ui/Modal'

export default function EndProjectDialog({
  projectId,
  openTaskCount,
  onClose,
}: {
  projectId: string
  openTaskCount: number
  onClose: () => void
}) {
  const router = useRouter()
  const [outcome, setOutcome] = useState<'completed' | 'cancelled'>('completed')
  const [reason, setReason] = useState('')
  const [cancelTasks, setCancelTasks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()

  async function submit() {
    setBusy(true); setError('')
    const res = await endProject({ id: projectId, outcome, reason: reason.trim() || undefined, cancelOpenTasks: cancelTasks })
    if (res.error) { setError(res.error); setBusy(false); return }
    onClose()
    router.refresh()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="End project"
      closeLabel="Close end project dialog"
      overlayClassName="p-4"
      panelClassName="panel w-full max-w-[440px] p-5"
    >
      <div className="panel-section-title">End project</div>
      <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" name="outcome" checked={outcome === 'completed'} onChange={() => setOutcome('completed')} />
            <span><strong>Completed</strong> — work finished as planned</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" name="outcome" checked={outcome === 'cancelled'} onChange={() => setOutcome('cancelled')} />
            <span><strong>Cancelled</strong> — stopped without completing</span>
          </label>
        </div>

        <label className="block">
          <span className="field-label">Reason (optional)</span>
          <textarea
            className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[3rem] resize-y"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>

        {openTaskCount > 0 ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={cancelTasks} onChange={(e) => setCancelTasks(e.target.checked)} />
            Also cancel {openTaskCount} open task{openTaskCount === 1 ? '' : 's'} on this project
          </label>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No open tasks linked to this project.</p>
        )}

        {error ? <p id={errorId} role="alert" style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-sm" style={{ background: 'var(--red)', color: 'white' }} onClick={submit} disabled={busy}>
            {busy ? 'Ending…' : `End project (${outcome === 'completed' ? 'Completed' : 'Cancelled'})`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
