'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Narrative } from '@/lib/reports/narrative'
import {
  saveNarrativeAction,
  regenerateSectionAction,
  regenerateFullAction,
  setRecipientsAction,
  sendReportAction,
} from '@/app/(os)/engagements/[id]/reports/actions'

type SectionKey = 'executive_summary' | 'highlights' | 'work_completed' | 'hours_commentary' | 'next_period' | 'risks_or_blockers'

const KIND_LABEL: Record<string, string> = { weekly_client: 'Weekly report', monthly_client: 'Monthly report', weekly_internal: 'Internal report' }

function linesToArr(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function ReportReviewClient(props: {
  engagementId: string
  engagementName: string
  reportId: string
  kind: string
  status: 'draft' | 'sent' | 'archived'
  periodStart: string
  periodEnd: string
  narrative: Narrative
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

  // Narrative as an editable text model.
  const [exec, setExec] = useState(props.narrative.executive_summary)
  const [highlights, setHighlights] = useState(props.narrative.highlights.join('\n'))
  const [work, setWork] = useState(props.narrative.work_completed.map((s) => ({ title: s.section_title, items: s.items.join('\n') })))
  const [hours, setHours] = useState(props.narrative.hours_commentary)
  const [next, setNext] = useState(props.narrative.next_period.join('\n'))
  const [risks, setRisks] = useState(props.narrative.risks_or_blockers.join('\n'))

  const [recipients, setRecipients] = useState<string[]>(props.recipients)
  const [recipientInput, setRecipientInput] = useState('')

  const assemble = useMemo(
    () => (): Narrative => ({
      executive_summary: exec.trim(),
      highlights: linesToArr(highlights),
      work_completed: work.map((s) => ({ section_title: s.title.trim(), items: linesToArr(s.items) })).filter((s) => s.section_title || s.items.length),
      hours_commentary: hours.trim(),
      next_period: linesToArr(next),
      risks_or_blockers: linesToArr(risks),
    }),
    [exec, highlights, work, hours, next, risks]
  )

  function run(fn: () => Promise<{ error?: string }>, after?: () => void) {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else {
        after?.()
        router.refresh()
      }
    })
  }

  function save() {
    run(() => saveNarrativeAction(props.reportId, assemble()), () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000) })
  }
  function regenSection(key: SectionKey) {
    // Persist current edits first so other sections aren't lost, then regenerate one.
    run(async () => {
      const saved = await saveNarrativeAction(props.reportId, assemble())
      if (saved.error) return saved
      return regenerateSectionAction(props.reportId, key)
    })
  }
  function regenAll() {
    run(() => regenerateFullAction(props.reportId))
  }
  function saveRecipients(list: string[]) {
    setRecipients(list)
    run(() => setRecipientsAction(props.reportId, list))
  }
  function addRecipient(email: string) {
    const e = email.trim().toLowerCase()
    if (!e || recipients.includes(e)) return
    saveRecipients([...recipients, e])
    setRecipientInput('')
  }
  function send() {
    if (!recipients.length || !confirm(`Send this report to ${recipients.length} recipient(s)? This cannot be undone.`)) return
    run(() => sendReportAction(props.reportId))
  }

  const input = 'w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const sectionWrap = 'rounded-2xl border border-[color:var(--border)] p-4'
  const sectionHead = 'flex items-center justify-between gap-2 mb-2'
  const label = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-3)]'

  function regenBtn(section: SectionKey) {
    if (readOnly) return null
    return (
      <button type="button" disabled={pending} onClick={() => regenSection(section)} className="text-[11px] text-[color:var(--accent-strong)] hover:underline disabled:opacity-50">
        Regenerate
      </button>
    )
  }

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
              <button type="button" disabled={pending} onClick={regenAll} className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--text-2)] hover:text-[color:var(--text)] disabled:opacity-60">Regenerate all</button>
              <button type="button" disabled={pending} onClick={save} className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60">{savedFlash ? 'Saved ✓' : 'Save draft'}</button>
            </>
          ) : null}
        </div>
      </div>

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

        {/* Narrative editor / recipients */}
        <div className="space-y-4">
          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Executive summary</span>{regenBtn('executive_summary')}</div>
            <textarea className={`${input} min-h-[5rem] resize-y`} value={exec} onChange={(e) => setExec(e.target.value)} readOnly={readOnly} />
          </div>

          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Highlights (one per line)</span>{regenBtn('highlights')}</div>
            <textarea className={`${input} min-h-[5rem] resize-y`} value={highlights} onChange={(e) => setHighlights(e.target.value)} readOnly={readOnly} />
          </div>

          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Work completed</span>{regenBtn('work_completed')}</div>
            <div className="space-y-3">
              {work.map((s, i) => (
                <div key={i} className="space-y-1">
                  <input className={input} value={s.title} placeholder="Section title" readOnly={readOnly} onChange={(e) => setWork((w) => w.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <textarea className={`${input} min-h-[4rem] resize-y`} value={s.items} placeholder="Items, one per line" readOnly={readOnly} onChange={(e) => setWork((w) => w.map((x, j) => (j === i ? { ...x, items: e.target.value } : x)))} />
                </div>
              ))}
              {work.length === 0 ? <p className="text-xs text-[color:var(--text-3)]">No sections yet. Regenerate to draft them.</p> : null}
            </div>
          </div>

          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Hours commentary</span>{regenBtn('hours_commentary')}</div>
            <textarea className={`${input} min-h-[4rem] resize-y`} value={hours} onChange={(e) => setHours(e.target.value)} readOnly={readOnly} />
          </div>

          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Next period (one per line)</span>{regenBtn('next_period')}</div>
            <textarea className={`${input} min-h-[4rem] resize-y`} value={next} onChange={(e) => setNext(e.target.value)} readOnly={readOnly} />
          </div>

          <div className={sectionWrap}>
            <div className={sectionHead}><span className={label}>Risks &amp; blockers (one per line, optional)</span>{regenBtn('risks_or_blockers')}</div>
            <textarea className={`${input} min-h-[3rem] resize-y`} value={risks} onChange={(e) => setRisks(e.target.value)} readOnly={readOnly} />
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
                  {props.suggested.filter((s) => !recipients.includes(s.email.toLowerCase())).map((s) => (
                    <button key={s.email} type="button" onClick={() => addRecipient(s.email)} className="rounded-full border border-dashed border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--text-2)] hover:border-[color:var(--accent)]">
                      + {s.name} ({s.email})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!readOnly ? (
              <button
                type="button"
                disabled={pending || recipients.length === 0}
                onClick={send}
                title={recipients.length === 0 ? 'Add a recipient first' : 'Send with PDF + timesheet attached'}
                className="mt-3 w-full rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Sending…' : `Send${recipients.length ? ` to ${recipients.length}` : ''}`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
