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
          <button type="button" onClick={() => { setPeriodStart(''); setPeriodEnd('') }} className="btn btn-text btn-sm">clear</button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => generate('weekly_client')}
          className="btn btn-primary btn-sm"
        >
          {busyKind === 'weekly_client' ? 'Generating…' : 'Weekly report'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => generate('monthly_client')}
          className="btn btn-ghost btn-sm"
        >
          {busyKind === 'monthly_client' ? 'Generating…' : 'Monthly report'}
        </button>
      </div>
      {error ? <p className="text-xs text-[color:var(--red-strong)]">{error}</p> : null}
    </div>
  )
}
