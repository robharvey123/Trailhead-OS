'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Narrative } from '@/lib/reports/narrative'
import {
  saveNarrativeAction,
  regenerateFullAction,
  setRecipientsAction,
  sendReportAction,
} from '@/app/(os)/engagements/[id]/reports/actions'

const KIND_LABEL: Record<string, string> = { weekly_client: 'Weekly report', monthly_client: 'Monthly report', weekly_internal: 'Internal report' }

type SpineTask = { title: string; description: string | null; due_date?: string | null }
type ReportFacts = {
  completed: SpineTask[]
  in_progress: SpineTask[]
  scheduled_next: SpineTask[]
  slipped: SpineTask[]
  hours: { used_in_period: number; months: Array<{ month: string; used: number; included: number | null; over: number }> }
  meetings: Array<{ date: string; title: string }>
  risks: Array<{ title: string; status: string }>
} | null

const labelOf = (t: SpineTask) => t.description || t.title

export default function ReportReviewClient(props: {
  engagementId: string
  engagementName: string
  reportId: string
  kind: string
  status: 'draft' | 'sent' | 'archived'
  narrativeError?: string | null
  periodStart: string
  periodEnd: string
  narrative: Narrative
  spine: ReportFacts
  pdfUrl: string | null
  xlsxUrl: string | null
  recipients: string[]
  suggested: { name: string; email: string }[]
  sentAt: string | null
  sentByName: string | null
}) {
  const router = useRouter()
  const readOnly = props.status !== 'draft'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  // Prose-only narrative model (the facts are rendered from the spine, not edited here).
  const [exec, setExec] = useState(props.narrative.executive_summary)
  const [hours, setHours] = useState(props.narrative.hours_commentary)
  const [outlook, setOutlook] = useState(props.narrative.outlook)
  const [risks, setRisks] = useState(props.narrative.risks_commentary)

  const [recipients, setRecipients] = useState<string[]>(props.recipients)
  const [recipientInput, setRecipientInput] = useState('')

  const assemble = useMemo(
    () => (): Narrative => ({
      executive_summary: exec.trim(),
      hours_commentary: hours.trim(),
      outlook: outlook.trim(),
      risks_commentary: risks.trim(),
    }),
    [exec, hours, outlook, risks]
  )

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else { after?.(); router.refresh() }
    })
  }
  function save() {
    run(() => saveNarrativeAction(props.reportId, assemble()), () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000) })
  }
  function regenAll() { run(() => regenerateFullAction(props.reportId)) }
  function saveRecipients(list: string[]) { setRecipients(list); run(() => setRecipientsAction(props.reportId, list)) }
  function addRecipient(email: string) {
    const e = email.trim().toLowerCase()
    if (!e || recipients.includes(e)) return
    saveRecipients([...recipients, e]); setRecipientInput('')
  }
  function send() {
    if (!recipients.length || !confirm(`Send this report to ${recipients.length} recipient(s)? This cannot be undone.`)) return
    run(() => sendReportAction(props.reportId))
  }

  const input = 'w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const sectionWrap = 'rounded-2xl border border-[color:var(--border)] p-4'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-3)]'

  const s = props.spine
  const factGroups: Array<{ head: string; items: string[] }> = s ? [
    { head: `Completed (${s.completed.length})`, items: s.completed.map(labelOf) },
    { head: `In progress (${s.in_progress.length})`, items: s.in_progress.map(labelOf) },
    { head: `Scheduled next (${s.scheduled_next.length})`, items: s.scheduled_next.map(labelOf) },
    { head: `Slipped (${s.slipped.length})`, items: s.slipped.map(labelOf) },
    { head: `Meetings (${s.meetings.length})`, items: s.meetings.map((m) => `${m.date} — ${m.title}`) },
    { head: `Risks (${s.risks.length})`, items: s.risks.map((r) => `${r.title} (${r.status})`) },
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[color:var(--text-3)]">{props.engagementName}</p>
          <h1 className="os-page-title mt-1">{KIND_LABEL[props.kind] ?? 'Report'}</h1>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">{props.periodStart} → {props.periodEnd}</p>
          {props.status === 'sent' ? (
            <p className="mt-1 text-xs text-emerald-700">Sent {props.sentAt ? new Date(props.sentAt).toLocaleString('en-GB') : ''}{props.sentByName ? ` by ${props.sentByName}` : ''}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {props.xlsxUrl ? <a href={props.xlsxUrl} className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--text-2)] hover:text-[color:var(--text)]">Download timesheet</a> : null}
          {!readOnly ? (
            <>
              <button type="button" disabled={pending} onClick={regenAll} className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--text-2)] hover:text-[color:var(--text)] disabled:opacity-60">Regenerate prose</button>
              <button type="button" disabled={pending} onClick={save} className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60">{savedFlash ? 'Saved ✓' : 'Save draft'}</button>
            </>
          ) : null}
        </div>
      </div>

      {props.narrativeError ? (
        <div className="rounded-2xl border border-[color:var(--amber)] bg-[var(--amber-dim)] px-4 py-3 text-sm text-[color:var(--amber-strong)]">
          <strong>AI narrative not applied</strong> — the report still shows the factual lists below, but has no written prose.
          Click “Regenerate prose”, or write the sections manually. Reason: {props.narrativeError}
        </div>
      ) : null}
      {error ? <p className="text-sm text-[color:var(--red)]">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* PDF preview */}
        <div className="os-card p-2">
          {props.pdfUrl ? (
            <iframe src={props.pdfUrl} title="Report PDF" className="h-[760px] w-full rounded-xl" />
          ) : (
            <p className="p-6 text-sm text-[color:var(--text-3)]">PDF not available yet. Save to render it.</p>
          )}
        </div>

        <div className="space-y-4">
          {/* Facts (read-only — rendered directly into the PDF from the spine) */}
          {s ? (
            <div className={sectionWrap}>
              <div className="mb-2 flex items-center justify-between">
                <span className={label}>Report facts (from the activity log — not editable)</span>
                <span className="text-[11px] text-[color:var(--text-3)]">{s.hours.used_in_period.toFixed(1)}h in period</span>
              </div>
              <div className="space-y-2">
                {factGroups.map((g) => (
                  <div key={g.head}>
                    <p className="text-xs font-semibold text-[color:var(--text-2)]">{g.head}</p>
                    {g.items.length ? (
                      <ul className="ml-4 list-disc text-xs text-[color:var(--text-2)]">{g.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                    ) : <p className="ml-4 text-xs text-[color:var(--text-3)]">—</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Prose (editable) */}
          <div className={sectionWrap}>
            <span className={label}>Executive summary</span>
            <textarea className={`${input} mt-2 min-h-[5rem] resize-y`} value={exec} onChange={(e) => setExec(e.target.value)} readOnly={readOnly} />
          </div>
          <div className={sectionWrap}>
            <span className={label}>Hours commentary</span>
            <textarea className={`${input} mt-2 min-h-[4rem] resize-y`} value={hours} onChange={(e) => setHours(e.target.value)} readOnly={readOnly} />
          </div>
          <div className={sectionWrap}>
            <span className={label}>Outlook (next period)</span>
            <textarea className={`${input} mt-2 min-h-[4rem] resize-y`} value={outlook} onChange={(e) => setOutlook(e.target.value)} readOnly={readOnly} />
          </div>
          <div className={sectionWrap}>
            <span className={label}>Risks commentary (optional)</span>
            <textarea className={`${input} mt-2 min-h-[3rem] resize-y`} value={risks} onChange={(e) => setRisks(e.target.value)} readOnly={readOnly} />
          </div>

          {/* Recipients */}
          <div className={sectionWrap}>
            <span className={label}>Sending to</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {recipients.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-xs text-[color:var(--text)]">
                  {r}
                  {!readOnly ? <button type="button" onClick={() => saveRecipients(recipients.filter((x) => x !== r))} className="text-[color:var(--text-3)]">✕</button> : null}
                </span>
              ))}
              {recipients.length === 0 ? <span className="text-xs text-[color:var(--text-3)]">No recipients added yet.</span> : null}
            </div>
            {!readOnly ? (
              <div className="mt-2 flex gap-2">
                <input className={input} placeholder="add email…" value={recipientInput} onChange={(e) => setRecipientInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(recipientInput) } }} />
                <button type="button" className="rounded-2xl border border-[color:var(--border)] px-3 text-sm" onClick={() => addRecipient(recipientInput)}>Add</button>
              </div>
            ) : null}
            {!readOnly && props.suggested.length ? (
              <div className="mt-2">
                <p className="text-[11px] text-[color:var(--text-3)]">Suggested (click to add):</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {props.suggested.filter((sg) => !recipients.includes(sg.email.toLowerCase())).map((sg) => (
                    <button key={sg.email} type="button" onClick={() => addRecipient(sg.email)} className="rounded-full border border-dashed border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--text-2)] hover:border-[color:var(--accent)]">
                      + {sg.name} ({sg.email})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {!readOnly ? (
              <button type="button" disabled={pending || recipients.length === 0} onClick={send} title={recipients.length === 0 ? 'Add a recipient first' : 'Send with PDF + timesheet attached'} className="mt-3 w-full rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? 'Sending…' : `Send${recipients.length ? ` to ${recipients.length}` : ''}`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
