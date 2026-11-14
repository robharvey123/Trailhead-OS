'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { pushSupported, registerServiceWorker, subscribeToPush } from '@/lib/push/client'

const DELAY_MS = 30_000 // wait ~30s before the first-run nudge
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000 // "Not now" dismisses for 7 days

/**
 * Registers the service worker on mount, then (after a delay) shows a one-time,
 * non-intrusive nudge to enable push — only if supported, permission is still
 * "default", and we haven't asked this user in the last 7 days.
 */
export default function PushPromptBanner({ userId }: { userId: string }) {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const key = `push-asked:${userId}`

  useEffect(() => {
    // SW registration is harmless even if the user never enables push.
    void registerServiceWorker().catch(() => {})

    if (!pushSupported() || Notification.permission !== 'default') return
    const asked = Number(window.localStorage.getItem(key) ?? 0)
    if (asked && Date.now() - asked < SNOOZE_MS) return

    const t = setTimeout(() => setShow(true), DELAY_MS)
    return () => clearTimeout(t)
  }, [key])

  if (!show) return null

  function dismiss() {
    window.localStorage.setItem(key, String(Date.now()))
    setShow(false)
  }

  async function enable() {
    setBusy(true)
    await subscribeToPush().catch(() => null)
    window.localStorage.setItem(key, String(Date.now()))
    setBusy(false)
    setShow(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-[340px] rounded-card border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[var(--shadow-lg)]">
      <p className="m-0 text-[13px] font-semibold text-[var(--text)]">Turn on notifications?</p>
      <p className="mb-3 mt-1 text-xs text-[var(--text-2)]">
        Get notified about messages and tasks assigned to you, even when this tab isn’t open.
      </p>
      <div className="flex items-center gap-2">
        <button className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>{busy ? 'Enabling…' : 'Enable'}</button>
        <button className="btn btn-ghost btn-sm" onClick={dismiss} disabled={busy}>Not now</button>
        <Link href="/settings/notifications" onClick={dismiss} className="ml-auto text-[11px] text-[var(--text-3)]">
          Settings
        </Link>
      </div>
    </div>
  )
}
