'use client'

import { useId, useState, useTransition } from 'react'
import { logOutcome } from '@/app/(sales)/sales/actions'
import {
  NEEDS_DATE,
  NEEDS_REASON,
  NEEDS_SUMMARY,
  OUTCOME_CODES,
  OUTCOME_LABELS,
  STAGE_LABELS,
  type OutcomeCode,
  type PipelineStage,
} from '@/lib/sales/queue'

const CHANNEL_OPTIONS = [
  { value: 'call', label: 'Call' },
  { value: 'demo', label: 'Demo (ran it)' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const

const POSITIVE: ReadonlySet<OutcomeCode> = new Set(['CONV', 'DEMO', 'TRIAL', 'WON'])
const NEGATIVE: ReadonlySet<OutcomeCode> = new Set(['DQ', 'LOST'])

/**
 * One-click outcome logger: the ten codes as buttons, a summary, a next-action
 * date, and a reason for DQ / LOST. Validation mirrors log_sales_outcome, which
 * re-checks everything server-side.
 */
export default function OutcomeLogger({
  contactId,
  onLogged,
  compact = false,
}: {
  contactId: string
  onLogged?: (stageAfter: PipelineStage) => void
  compact?: boolean
}) {
  const uid = useId()
  const [code, setCode] = useState<OutcomeCode | null>(null)
  const [summary, setSummary] = useState('')
  const [nextAt, setNextAt] = useState('')
  const [reason, setReason] = useState('')
  const [channel, setChannel] = useState<(typeof CHANNEL_OPTIONS)[number]['value']>('call')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needsSummary = code ? NEEDS_SUMMARY.has(code) : false
  const needsReason = code ? NEEDS_REASON.has(code) : false
  const needsDate = code ? NEEDS_DATE.has(code) : false
  const showDate = code === 'CB' || code === 'DEMO' || code === 'CONV' || code === 'TRIAL' || code === 'NA' || code === 'VM' || code === 'GK'

  function submit() {
    if (!code) {
      setError('Pick an outcome.')
      return
    }
    setError(null)
    setDone(null)
    startTransition(async () => {
      const res = await logOutcome({
        contactId,
        outcome: code,
        summary,
        channel,
        nextActionAt: nextAt ? new Date(nextAt).toISOString() : null,
        durationSeconds: minutes ? Math.round(Number(minutes) * 60) : null,
        reason,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      const stage = res.data?.stageAfter
      setDone(`Logged ${OUTCOME_LABELS[code]}${stage ? `. Stage: ${STAGE_LABELS[stage]}.` : '.'}`)
      setCode(null)
      setSummary('')
      setNextAt('')
      setReason('')
      setMinutes('')
      if (stage) onLogged?.(stage)
    })
  }

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]'

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Outcome" className="flex flex-wrap gap-1.5">
        {OUTCOME_CODES.map((c) => {
          const active = code === c
          const tone = POSITIVE.has(c) ? 'border-emerald-300' : NEGATIVE.has(c) ? 'border-rose-300' : 'border-[var(--border)]'
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              title={OUTCOME_LABELS[c]}
              onClick={() => {
                setCode(c)
                setError(null)
                setDone(null)
              }}
              className={`tap rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${tone} ${
                active ? 'bg-[var(--accent-strong)] text-white' : 'bg-[var(--surface)] text-[color:var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {c}
              {compact ? null : <span className="ml-1 font-normal opacity-80">{OUTCOME_LABELS[c]}</span>}
            </button>
          )
        })}
      </div>

      {code ? (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className={label} htmlFor={`${uid}-summary`}>
              Summary{needsSummary ? ' (required)' : ''}
            </label>
            <textarea id={`${uid}-summary`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className={input} placeholder="What did they say?" />
          </div>
          <div className="space-y-3">
            {showDate ? (
              <div>
                <label className={label} htmlFor={`${uid}-next`}>
                  {code === 'DEMO' ? 'Demo date and time' : 'Next action'}{needsDate ? ' (required)' : ''}
                </label>
                <input id={`${uid}-next`} type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} className={input} />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label} htmlFor={`${uid}-channel`}>Channel</label>
                <select id={`${uid}-channel`} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={input}>
                  {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor={`${uid}-mins`}>Minutes</label>
                <input id={`${uid}-mins`} type="number" min={0} step={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={input} />
              </div>
            </div>
          </div>
          {needsReason ? (
            <div className="sm:col-span-2">
              <label className={label} htmlFor={`${uid}-reason`}>Reason (required)</label>
              <input id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={input} placeholder={code === 'DQ' ? 'Why they are not a fit' : 'Why they said no'} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !code} onClick={submit}>
          {pending ? 'Logging…' : code ? `Log ${OUTCOME_LABELS[code]}` : 'Log outcome'}
        </button>
        <span role="status" className="text-xs">
          {error ? <span className="text-[color:var(--red)]">{error}</span> : done ? <span className="text-[color:var(--text-2)]">{done}</span> : null}
        </span>
      </div>
    </div>
  )
}
