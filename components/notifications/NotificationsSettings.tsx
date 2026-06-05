'use client'

import { useEffect, useState } from 'react'
import { isSubscribed, pushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push/client'
import { updateNotificationSetting } from '@/app/(os)/settings/notifications/actions'
import type { NotificationSettings } from '@/lib/types'

type PermState = 'unsupported' | 'default' | 'granted' | 'denied'

const CATEGORIES: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'push_direct_message', label: 'Direct messages' },
  { key: 'push_mention', label: 'Mentions' },
  { key: 'push_task_assigned', label: 'Tasks assigned to me' },
]

export default function NotificationsSettings({ initialSettings }: { initialSettings: NotificationSettings }) {
  const [perm, setPerm] = useState<PermState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [settings, setSettings] = useState<NotificationSettings>(initialSettings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Browser-only reads (permission + existing subscription) — done in a closure
    // so this isn't a synchronous setState in the effect body.
    void (async () => {
      if (!pushSupported()) { if (active) setPerm('unsupported'); return }
      const sub = await isSubscribed()
      if (!active) return
      setPerm(Notification.permission as PermState)
      setSubscribed(sub)
    })()
    return () => { active = false }
  }, [])

  async function enable() {
    setBusy(true); setError('')
    const sub = await subscribeToPush()
    setPerm(Notification.permission as PermState)
    if (sub) setSubscribed(true)
    else if (Notification.permission !== 'denied') setError('Could not enable notifications.')
    setBusy(false)
  }

  async function disable() {
    setBusy(true); setError('')
    await unsubscribeFromPush()
    setSubscribed(false)
    setBusy(false)
  }

  async function toggle(key: keyof NotificationSettings) {
    const next = !settings[key]
    setSettings((s) => ({ ...s, [key]: next }))
    const res = await updateNotificationSetting(key, next)
    if (res.error) {
      setSettings((s) => ({ ...s, [key]: !next })) // revert
      setError(res.error)
    }
  }

  const pill =
    perm === 'unsupported' ? { text: 'Not supported', bg: 'var(--surface-3)', fg: 'var(--text-3)' }
    : perm === 'denied' ? { text: 'Blocked', bg: 'rgba(239,68,68,0.12)', fg: 'var(--red-strong)' }
    : subscribed && perm === 'granted' ? { text: 'Enabled', bg: 'rgba(16,185,129,0.14)', fg: 'var(--green-strong, #047857)' }
    : { text: 'Disabled', bg: 'var(--surface-3)', fg: 'var(--text-2)' }

  return (
    <div className="panel" style={{ padding: 20, display: 'grid', gap: 16, maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 className="topbar-title" style={{ flex: 1 }}>Push notifications</h1>
        <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '3px 10px', background: pill.bg, color: pill.fg }}>
          {pill.text}
        </span>
      </div>

      {perm === 'unsupported' ? (
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          This browser doesn’t support web push. Try Chrome, Edge, Firefox, or Safari 16.4+ (add to Home Screen on iOS).
        </p>
      ) : perm === 'denied' ? (
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          Notifications are blocked. Reset the permission for this site in your browser settings, then reload to enable.
        </p>
      ) : subscribed ? (
        <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={disable} disabled={busy}>
          Disable on this device
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" style={{ justifySelf: 'start' }} onClick={enable} disabled={busy}>
          {busy ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p> : null}

      <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', margin: 0 }}>
          Notify me about
        </p>
        {CATEGORIES.map((c) => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
            <span>{c.label}</span>
            <input type="checkbox" checked={settings[c.key]} onChange={() => toggle(c.key)} />
          </label>
        ))}
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
          Applies to every device you’ve enabled. Pushes only arrive while notifications are enabled above.
        </p>
      </div>
    </div>
  )
}
