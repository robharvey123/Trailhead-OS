'use client'

import { useMemo, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import {
  ENGAGEMENT_TASK_PRIORITIES,
  ENGAGEMENT_TASK_PRIORITY_LABELS,
} from '@/lib/types'
import type { EngagementTaskPriority } from '@/lib/types'
import type { RoadmapExtraction, RoadmapMilestone, RoadmapTask } from '@/lib/roadmap/schema'
import { commitRoadmapImport } from './actions'

const input = 'w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

export default function RoadmapReviewClient({
  projectId,
  importId,
  initial,
  committed,
}: {
  projectId: string
  importId: string
  initial: RoadmapExtraction
  committed: boolean
}) {
  const [extraction, setExtraction] = useState<RoadmapExtraction>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const readOnly = committed

  const taskCount = useMemo(
    () => extraction.milestones.reduce((n, m) => n + m.tasks.length, 0),
    [extraction]
  )

  function updateMilestone(mi: number, patch: Partial<RoadmapMilestone>) {
    setExtraction((e) => ({ ...e, milestones: e.milestones.map((m, i) => (i === mi ? { ...m, ...patch } : m)) }))
  }
  function updateTask(mi: number, ti: number, patch: Partial<RoadmapTask>) {
    setExtraction((e) => ({
      ...e,
      milestones: e.milestones.map((m, i) =>
        i === mi ? { ...m, tasks: m.tasks.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : m
      ),
    }))
  }
  function removeTask(mi: number, ti: number) {
    setExtraction((e) => ({
      ...e,
      milestones: e.milestones.map((m, i) => (i === mi ? { ...m, tasks: m.tasks.filter((_, j) => j !== ti) } : m)),
    }))
  }
  function removeMilestone(mi: number) {
    setExtraction((e) => ({ ...e, milestones: e.milestones.filter((_, i) => i !== mi) }))
  }
  function addTask(mi: number) {
    updateMilestone(mi, { tasks: [...extraction.milestones[mi].tasks, { title: '', priority: 'normal', labels: [] }] })
  }

  async function commit() {
    setBusy(true); setError('')
    const res = await commitRoadmapImport(importId, extraction)
    if (res?.error) { setError(res.error); setBusy(false) }
    // success → server action redirects to the engagement task board
  }

  return (
    <>
      <PageHeader
        title={committed ? 'Imported roadmap' : 'Review extracted tasks'}
        count={<>{taskCount} task{taskCount === 1 ? '' : 's'}</>}
        back={{ href: `/projects/records/${projectId}`, label: 'Project' }}
        actions={
          !readOnly ? (
            <button className="btn btn-primary btn-sm" onClick={commit} disabled={busy || taskCount === 0}>
              {busy ? 'Creating…' : `Create ${taskCount} task${taskCount === 1 ? '' : 's'}`}
            </button>
          ) : null
        }
      />
      <div className="panel overflow-hidden">
        {readOnly ? (
          <p className="bg-[var(--surface-2)] px-6 py-2 text-xs text-[var(--text-2)]">
            Committed — read-only audit view of what was extracted and created.
          </p>
        ) : null}
        {error ? <p className="px-6 py-2 text-xs text-[var(--red)]">{error}</p> : null}

        <div className="grid gap-4 p-6">
          {extraction.milestones.length === 0 ? <div className="empty">No milestones extracted.</div> : null}
          {extraction.milestones.map((m, mi) => (
            <details key={mi} className="card" open>
              <summary className="flex cursor-pointer items-center justify-between">
                <span className="td-name">{m.name} <span className="td-num">· {m.tasks.length}</span></span>
                {!readOnly ? (
                  <button className="btn btn-danger btn-sm" onClick={(ev) => { ev.preventDefault(); removeMilestone(mi) }}>Remove milestone</button>
                ) : null}
              </summary>

              {m.summary ? <p className="mb-2.5 mt-1.5 text-xs text-[var(--text-3)]">{m.summary}</p> : null}

              <div className="mt-2.5 grid gap-2.5">
                {m.tasks.map((t, ti) => (
                  <div key={ti} className="rounded-control border border-[var(--border)] p-2.5">
                    {readOnly ? (
                      <div>
                        <div className="td-name text-[13px]">{t.title}</div>
                        {t.description ? <div className="td-sub">{t.description}</div> : null}
                        <div className="td-num mt-1">
                          {ENGAGEMENT_TASK_PRIORITY_LABELS[t.priority]}{t.suggested_due_date ? ` · due ${t.suggested_due_date}` : ''}{t.labels.length ? ` · ${t.labels.join(', ')}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-1.5">
                        <div className="flex items-start gap-2">
                          <input className={input} value={t.title} placeholder="Task title" onChange={(e) => updateTask(mi, ti, { title: e.target.value })} />
                          <button className="btn btn-ghost btn-sm" title="Remove task" onClick={() => removeTask(mi, ti)}>✕</button>
                        </div>
                        <textarea className={`${input} min-h-[2.5rem] resize-y`} value={t.description ?? ''} placeholder="Description (optional)" onChange={(e) => updateTask(mi, ti, { description: e.target.value || undefined })} />
                        <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                          <select className={input} value={t.priority} onChange={(e) => updateTask(mi, ti, { priority: e.target.value as EngagementTaskPriority })}>
                            {ENGAGEMENT_TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{ENGAGEMENT_TASK_PRIORITY_LABELS[p]}</option>))}
                          </select>
                          <input type="date" className={input} value={t.suggested_due_date ?? ''} title="Suggested due date" onChange={(e) => updateTask(mi, ti, { suggested_due_date: e.target.value || undefined })} />
                          <input className={input} value={t.labels.join(', ')} placeholder="labels, comma-separated" onChange={(e) => updateTask(mi, ti, { labels: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                        </div>
                        {t.suggested_due_date ? <span className="text-[10px] text-[var(--text-3)]">suggested date — clear it if you don’t want to commit a due date</span> : null}
                      </div>
                    )}
                  </div>
                ))}
                {!readOnly ? (
                  <button className="btn btn-ghost btn-sm justify-self-start" onClick={() => addTask(mi)}>+ Add task</button>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  )
}
