'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncGranolaNow } from '@/app/(os)/crm/actions'

/** "Sync now" control on the Meetings page — invokes the shared Granola sync. */
export default function SyncGranolaButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await syncGranolaNow()
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const parts = [`${res.synced ?? 0} synced`, `${res.linked ?? 0} linked`]
    if (res.rateLimited) parts.push('rate limited — try again shortly')
    setMessage(parts.join(' · '))
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      {message ? <span className="text-xs text-[var(--muted)]">{message}</span> : null}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--lime)]/40 disabled:opacity-60"
      >
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  )
}
