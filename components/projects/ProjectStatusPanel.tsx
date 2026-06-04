'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EndProjectDialog from './EndProjectDialog'
import EngagementPicker, { type EngagementOption } from './EngagementPicker'
import { reopenProject, setProjectEngagement, setProjectStatus } from '@/app/(os)/projects/records/[id]/actions'

const ENDED = new Set(['completed', 'cancelled'])
const ACTIVE_PHASE: Array<{ value: string; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
]
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
}

export default function ProjectStatusPanel({
  projectId,
  status,
  endedAt,
  endedReason,
  linkedEngagement,
  engagements,
  openTaskCount,
  isAdmin,
}: {
  projectId: string
  status: string
  endedAt: string | null
  endedReason: string | null
  linkedEngagement: { id: string; name: string } | null
  engagements: EngagementOption[]
  openTaskCount: number
  isAdmin: boolean
}) {
  const router = useRouter()
  const [endOpen, setEndOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  const [pick, setPick] = useState(linkedEngagement?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ended = ENDED.has(status)

  async function reopen() {
    setBusy(true); setError('')
    const res = await reopenProject(projectId)
    if (res.error) setError(res.error)
    else router.refresh()
    setBusy(false)
  }
  async function saveEngagement() {
    setBusy(true); setError('')
    const res = await setProjectEngagement(projectId, pick)
    if (res.error) { setError(res.error); setBusy(false); return }
    setChanging(false); setBusy(false); router.refresh()
  }
  async function saveStatus(next: string) {
    if (next === status) return
    setBusy(true); setError('')
    const res = await setProjectStatus(projectId, next)
    if (res.error) setError(res.error)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="panel" style={{ padding: 20, display: 'grid', gap: 14 }}>
      {ended ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Ended {fmtDate(endedAt)}, marked <strong style={{ color: 'var(--text)' }}>{status === 'completed' ? 'Completed' : 'Cancelled'}</strong>
            {endedReason ? ` — ${endedReason}` : ''}
          </span>
          {isAdmin ? (
            <button className="btn btn-ghost btn-sm" onClick={reopen} disabled={busy} title="Reopening sets the project active again. Tasks cancelled when it ended are NOT restored.">
              Reopen
            </button>
          ) : null}
        </div>
      ) : isAdmin ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="field-label">Status</span>
            <select className="filter-select" value={status} onChange={(e) => saveStatus(e.target.value)} disabled={busy}>
              {ACTIVE_PHASE.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-strong)', borderColor: 'var(--red)' }} onClick={() => setEndOpen(true)}>
            End project
          </button>
        </div>
      ) : null}

      <div>
        <div className="field-label">Engagement</div>
        {changing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <EngagementPicker engagements={engagements} value={pick} onChange={setPick} disabled={busy} />
            <button className="btn btn-primary btn-sm" onClick={saveEngagement} disabled={busy || !pick}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setChanging(false); setPick(linkedEngagement?.id ?? '') }} disabled={busy}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
            <span className="td-name">
              {linkedEngagement ? <Link href={`/engagements/${linkedEngagement.id}`}>{linkedEngagement.name}</Link> : <span style={{ color: 'var(--text-3)' }}>Not linked</span>}
            </span>
            {isAdmin ? <button className="btn btn-ghost btn-sm" onClick={() => setChanging(true)}>Change</button> : null}
          </div>
        )}
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}

      {endOpen ? <EndProjectDialog projectId={projectId} openTaskCount={openTaskCount} onClose={() => setEndOpen(false)} /> : null}
    </div>
  )
}
