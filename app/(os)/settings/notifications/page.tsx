import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth/roles'
import { mockupFontVars } from '@/lib/fonts'
import NotificationsSettings from '@/components/notifications/NotificationsSettings'
import type { NotificationSettings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DEFAULTS: NotificationSettings = {
  push_direct_message: true,
  push_mention: true,
  push_task_assigned: true,
  push_new_email: true,
}

export default async function NotificationSettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const settings = { ...DEFAULTS, ...(profile.notification_settings ?? {}) }

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <NotificationsSettings initialSettings={settings} />
    </div>
  )
}
