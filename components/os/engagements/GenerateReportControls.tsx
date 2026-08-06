'use client'

import { useState, useTransition } from 'react'
import { generateReportAction } from '@/app/(os)/engagements/[id]/reports/actions'
import type { ReportKind } from '@/lib/reports/generate'

export default function GenerateReportControls({ engagementId }: { engagementId: string }) {
  const [pending, startTransition] = useTransition()
  const [busyKind, setBusyKind] = useState<ReportKind | null>(null)
  const [error, setError] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  function generate(kind: ReportKind) {
    setError('')
    setBusyKind(kind)
    startTransition(async () => {
      // On success the action redirects; an error result means it didn't.
      const res = await generateReportAction(engagementId, kind, { start: periodStart, end: periodEnd })
      if (res?.error) {
        setError(res.error)
        setBusyKind(null)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-[color:var(--text-2)]">
        <span>Period (optional)</span>
        <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="os-input px-2 py-1" aria-label="Period start" />
        <span>→</span>
        <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="os-input px-2 py-1" aria-label="Period end" />
        {(periodStart || periodEnd) ? (
          <button type="button" onClick={() => { setPeriodStart(''); setPeriodEnd('') }} className="text-[color:var(--text-3)] hover:text-[color:var(--text)]">clear</button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => generate('weekly_client')}
          className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {busyKind === 'weekly_client' ? 'Generating…' : 'Weekly report'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => generate('monthly_client')}
          className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--text-2)] transition hover:text-[color:var(--text)] disabled:opacity-60"
        >
          {busyKind === 'monthly_client' ? 'Generating…' : 'Monthly report'}
        </button>
      </div>
      {error ? <p className="text-xs text-[color:var(--red)]">{error}</p> : null}
    </div>
  )
}
