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
    <div
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 60, maxWidth: 340,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)', padding: 16,
      }}
    >
      <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontWeight: 600 }}>Turn on notifications?</p>
      <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 12px' }}>
        Get notified about messages and tasks assigned to you, even when this tab isn’t open.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>{busy ? 'Enabling…' : 'Enable'}</button>
        <button className="btn btn-ghost btn-sm" onClick={dismiss} disabled={busy}>Not now</button>
        <Link href="/settings/notifications" onClick={dismiss} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
          Settings
        </Link>
      </div>
    </div>
  )
}
