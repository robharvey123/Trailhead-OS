'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/os/ConfirmDialog'
import { deleteMilestone, deleteMilestones } from '@/app/(os)/projects/records/[id]/actions'
import type { ProjectMilestone } from '@/lib/types'

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export default function MilestoneList({
  milestones,
  dependentCounts,
}: {
  milestones: ProjectMilestone[]
  dependentCounts: Record<string, number>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [single, setSingle] = useState<ProjectMilestone | null>(null) // row pending delete
  const [bulkOpen, setBulkOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ids = milestones.map((m) => m.id)
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))

  // Cmd/Ctrl-A selects all visible (unless typing); Esc clears.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !typing) {
        e.preventDefault()
        setSelected(new Set(ids))
      } else if (e.key === 'Escape' && !single && !bulkOpen) {
        setSelected(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids, single, bulkOpen])

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids))
  }

  async function confirmSingle() {
    if (!single) return
    setBusy(true); setError('')
    const res = await deleteMilestone(single.id)
    if (res.error) { setError(res.error); setBusy(false); return }
    setSingle(null); setBusy(false)
    router.refresh()
  }

  const selectedList = milestones.filter((m) => selected.has(m.id))
  const blockedSelected = selectedList.filter((m) => (dependentCounts[m.id] ?? 0) > 0)

  async function confirmBulk() {
    setBusy(true); setError('')
    const res = await deleteMilestones(Array.from(selected))
    if (res.error) { setError(res.error); setBusy(false); return }
    if (res.blocked) { setError('Some milestones have linked tasks and were not deleted.'); setBusy(false); return }
    setBulkOpen(false); setSelected(new Set()); setBusy(false)
    router.refresh()
  }

  const singleBlocked = single ? (dependentCounts[single.id] ?? 0) > 0 : false

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="panel-section-title" style={{ margin: 0 }}>Milestones</div>
        <span className="td-mono" style={{ color: 'var(--text-3)' }}>{milestones.length}</span>
      </div>

      {/* Bulk action bar — below the modal overlay (z-index 40 < dialog 50). */}
      {selected.size > 0 ? (
        <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', marginBottom: 10, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 13 }}>{selected.size} selected</strong>
          <button className="btn btn-sm" style={{ background: 'var(--red)', color: 'white' }} onClick={() => setBulkOpen(true)}>Delete</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      ) : null}

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</p> : null}

      {milestones.length === 0 ? <div className="empty">No milestones.</div> : (
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th>
              <th>Title</th><th>Due</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m) => {
              const deps = dependentCounts[m.id] ?? 0
              return (
                <tr key={m.id}>
                  <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.title}`} /></td>
                  <td className="td-name">{m.title}{deps > 0 ? <span className="td-sub">{deps} linked task{deps === 1 ? '' : 's'}</span> : null}</td>
                  <td className="td-mono">{fmtDate(m.due_date)}</td>
                  <td><span className="channel-tag">{m.status}</span></td>
                  <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setSingle(m)}>Delete</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      )}

      {/* Single delete (or blocked) */}
      <ConfirmDialog
        open={!!single}
        onOpenChange={(o) => { if (!o) setSingle(null) }}
        title={singleBlocked ? 'Cannot delete milestone' : 'Delete milestone?'}
        description={
          singleBlocked
            ? `This milestone has ${dependentCounts[single?.id ?? ''] ?? 0} linked task(s). Reassign or delete them first.`
            : `${single?.title ?? 'This milestone'} will be permanently deleted. This cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel={singleBlocked ? 'Close' : 'Cancel'}
        hideConfirm={singleBlocked}
        variant="destructive"
        loading={busy}
        onConfirm={() => void confirmSingle()}
      />

      {/* Bulk delete (or blocked) */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={(o) => { if (!o) setBulkOpen(false) }}
        title={blockedSelected.length > 0 ? 'Some milestones can’t be deleted' : `Delete ${selected.size} milestone${selected.size === 1 ? '' : 's'}?`}
        description={
          blockedSelected.length > 0
            ? `${blockedSelected.length} of the selected milestones have linked tasks and can’t be deleted. Reassign or delete those tasks first, or deselect them.`
            : 'These milestones will be permanently deleted and cannot be recovered.'
        }
        items={(blockedSelected.length > 0 ? blockedSelected : selectedList).map((m) => m.title).slice(0, 10)}
        itemsLabel={blockedSelected.length > 0 ? 'Blocked by linked tasks' : `${selected.size} milestone${selected.size === 1 ? '' : 's'}`}
        confirmLabel={`Delete ${selected.size} milestone${selected.size === 1 ? '' : 's'}`}
        cancelLabel={blockedSelected.length > 0 ? 'Close' : 'Cancel'}
        hideConfirm={blockedSelected.length > 0}
        variant="destructive"
        loading={busy}
        onConfirm={() => void confirmBulk()}
      />
    </div>
  )
}
