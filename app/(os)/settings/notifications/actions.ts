'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationSettings } from '@/lib/types'

const DEFAULTS: NotificationSettings = {
  push_direct_message: true,
  push_mention: true,
  push_task_assigned: true,
  push_new_email: true,
}
const VALID = new Set(Object.keys(DEFAULTS))

/** Toggle one push category on the signed-in user's profile. */
export async function updateNotificationSetting(
  category: keyof NotificationSettings,
  enabled: boolean
): Promise<{ error?: string }> {
  if (!VALID.has(category)) return { error: 'Unknown setting' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: prof } = await supabase.from('profiles').select('notification_settings').eq('id', user.id).maybeSingle()
  const current = (prof?.notification_settings as NotificationSettings | null) ?? DEFAULTS
  const next = { ...DEFAULTS, ...current, [category]: enabled }

  // profiles self-writes go through the service role (matches updateDisplayName).
  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ notification_settings: next }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/settings/notifications')
  return {}
}
