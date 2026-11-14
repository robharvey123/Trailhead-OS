'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'

/**
 * "↻ Sync now" for the account/contact email sections. Runs the same
 * /api/gmail/sync call InboxClient uses, then router.refresh() so the
 * server-fetched emailThreads re-query. Surfaces the reconnect case explicitly.
 */
export default function SyncMailButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnect, setReconnect] = useState(false)

  async function sync() {
    setBusy(true)
    setError(null)
    setReconnect(false)
    try {
      const result = await apiFetch<{ reconnectRequired?: boolean }>('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sinceDays: 7 }),
      })
      if (result?.reconnectRequired) {
        setReconnect(true)
        return
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {reconnect ? (
        <Link href="/settings" className="td-sub text-[var(--amber-strong)]!">
          Reconnect Gmail in Settings
        </Link>
      ) : error ? (
        <span className="td-sub text-[var(--red-strong)]!">{error}</span>
      ) : null}
      <button type="button" className="btn btn-ghost btn-sm" onClick={sync} disabled={busy}>
        {busy ? 'Syncing…' : '↻ Sync now'}
      </button>
    </span>
  )
}
