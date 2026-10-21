'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { ScreenSummary } from '@/lib/ctps/screen'

const STOPPED: Record<NonNullable<ScreenSummary['stoppedReason']>, string> = {
  insufficient_credit: 'Stopped: Data Soap credits exhausted.',
  provider_rejected: 'Stopped: Data Soap rejected the account or token.',
  not_configured: 'DATASOAP_API_TOKEN is not set.',
}

/**
 * "Screen now" on the call queue: POST /api/outreach/ctps/screen (admin only)
 * for every contact due a CTPS/TPS screen, then show the summary inline and
 * refresh the server-rendered queue.
 */
export default function CtpsScreenButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<ScreenSummary | null>(null)

  async function screen() {
    setBusy(true)
    try {
      const result = await apiFetch<ScreenSummary>('/api/outreach/ctps/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      setSummary(result)
      if (result.stoppedReason) toast.error(STOPPED[result.stoppedReason])
      else toast.success(`Screened ${result.attempted}: ${result.clear} clear, ${result.registered} registered`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Screening failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={screen} disabled={busy}>
        {busy ? 'Screening…' : 'Screen now'}
      </button>
      {summary ? (
        <span className="text-xs">
          {summary.attempted} checked · {summary.clear} clear · {summary.registered} registered · {summary.failed} failed
          {summary.skipped ? ` · ${summary.skipped} skipped` : ''}
          {summary.creditsUsed ? ` · ${summary.creditsUsed} credits` : ''}
          {summary.stoppedReason ? ` · ${STOPPED[summary.stoppedReason]}` : ''}
        </span>
      ) : null}
    </span>
  )
}
