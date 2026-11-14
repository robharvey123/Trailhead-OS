'use client'

import { useEffect, useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { isSubscribed, pushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push/client'
import { updateNotificationSetting } from '@/app/(os)/settings/notifications/actions'
import type { NotificationSettings } from '@/lib/types'

type PermState = 'unsupported' | 'default' | 'granted' | 'denied'

const CATEGORIES: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'push_direct_message', label: 'Direct messages' },
  { key: 'push_mention', label: 'Mentions' },
  { key: 'push_task_assigned', label: 'Tasks assigned to me' },
  { key: 'push_new_email', label: 'New emails' },
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
    perm === 'unsupported' ? { text: 'Not supported', tone: 'status-grey' }
    : perm === 'denied' ? { text: 'Blocked', tone: 'status-red' }
    : subscribed && perm === 'granted' ? { text: 'Enabled', tone: 'status-green' }
    : { text: 'Disabled', tone: 'status-grey' }

  return (
    <div className="os-narrow">
      <PageHeader title="Push notifications" />
      <div className="panel grid max-w-[520px] gap-4 p-5">
        <div className="flex items-center gap-2.5">
          <span className={`status-badge no-dot ${pill.tone}`}>
            {pill.text}
          </span>
        </div>

        {perm === 'unsupported' ? (
          <p className="m-0 text-[13px] text-[var(--text-2)]">
            This browser doesn’t support web push. Try Chrome, Edge, Firefox, or Safari 16.4+ (add to Home Screen on iOS).
          </p>
        ) : perm === 'denied' ? (
          <p className="m-0 text-[13px] text-[var(--text-2)]">
            Notifications are blocked. Reset the permission for this site in your browser settings, then reload to enable.
          </p>
        ) : subscribed ? (
          <button className="btn btn-ghost btn-sm justify-self-start" onClick={disable} disabled={busy}>
            Disable on this device
          </button>
        ) : (
          <button className="btn btn-primary btn-sm justify-self-start" onClick={enable} disabled={busy}>
            {busy ? 'Enabling…' : 'Enable notifications'}
          </button>
        )}

        {error ? <p className="m-0 text-xs text-[var(--red)]">{error}</p> : null}

        <div className="grid gap-2.5 border-t border-[var(--border)] pt-3.5">
          <p className="os-label m-0">
            Notify me about
          </p>
          {CATEGORIES.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--text)]">
              <span>{c.label}</span>
              <input type="checkbox" checked={settings[c.key]} onChange={() => toggle(c.key)} />
            </label>
          ))}
          <p className="m-0 text-[11px] text-[var(--text-3)]">
            Applies to every device you’ve enabled. Pushes only arrive while notifications are enabled above.
          </p>
        </div>
      </div>
    </div>
  )
}
