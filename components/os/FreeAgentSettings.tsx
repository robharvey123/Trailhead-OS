'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { disconnectFreeAgentAction } from '@/app/(os)/settings/actions'

const PARAM_MESSAGES: Record<string, { type: 'success' | 'error'; text: string }> = {
  connected: { type: 'success', text: 'FreeAgent connected.' },
  error: { type: 'error', text: 'FreeAgent connection failed. Check the app credentials and redirect URI.' },
  config: { type: 'error', text: 'FreeAgent is not configured. Set the FREEAGENT_* env vars in Vercel and redeploy.' },
  forbidden: { type: 'error', text: 'Only an admin can connect FreeAgent.' },
}

export default function FreeAgentSettings({
  connected,
  connectedAt,
  configured,
}: {
  connected: boolean
  connectedAt: string | null
  configured: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const result = searchParams.get('freeagent')
    if (!result) return
    const msg = PARAM_MESSAGES[result]
    if (msg) toast[msg.type](msg.text)
    // Clean the param so the toast doesn't re-fire on refresh.
    router.replace('/settings')
  }, [searchParams, router])

  const [busy, setBusy] = useState(false)
  function disconnect() {
    if (!confirm('Disconnect FreeAgent? Invoices already pushed stay in FreeAgent; new pushes will fail until you reconnect.')) return
    setBusy(true)
    startTransition(async () => {
      const res = await disconnectFreeAgentAction()
      if (res.error) toast.error(res.error)
      else { toast.success('FreeAgent disconnected.'); router.refresh() }
      setBusy(false)
    })
  }

  const pill = connected
    ? { text: 'Connected', cls: 'bg-emerald-100 text-emerald-700' }
    : configured
      ? { text: 'Not connected', cls: 'bg-amber-100 text-amber-700' }
      : { text: 'Not configured', cls: 'bg-slate-100 text-slate-600' }

  return (
    <section className="os-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="os-eyebrow">Accounting</p>
          <h2 className="mt-2 os-section-title">FreeAgent</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pill.cls}`}>{pill.text}</span>
      </div>

      <p className="mt-3 text-sm text-[color:var(--text-2)]">
        Push Trailhead OS invoices into FreeAgent as drafts. One company connection, refreshed automatically.
      </p>

      {!configured ? (
        <p className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[color:var(--text-2)]">
          Set <code>FREEAGENT_CLIENT_ID</code>, <code>FREEAGENT_CLIENT_SECRET</code> and <code>FREEAGENT_REDIRECT_URI</code> in Vercel, then redeploy. The connect button appears once they’re live.
        </p>
      ) : connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {connectedAt ? <span className="text-xs text-[color:var(--text-3)]">Connected {new Date(connectedAt).toLocaleString('en-GB')}</span> : null}
          <a
            href="/api/freeagent/connect"
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
          >
            Reconnect
          </a>
          <button
            type="button"
            onClick={disconnect}
            disabled={pending || busy}
            className="rounded-2xl border border-[color:var(--red)] px-4 py-2.5 text-sm font-medium text-[color:var(--red)] transition hover:bg-[var(--red-dim)] disabled:opacity-60"
          >
            {busy ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <a
          href="/api/freeagent/connect"
          className="mt-4 inline-block rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Connect FreeAgent
        </a>
      )}
    </section>
  )
}
