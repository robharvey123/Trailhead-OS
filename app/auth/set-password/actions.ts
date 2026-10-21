'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsSales } from '@/lib/auth/roles'

export type SetPasswordResult = { ok: true; next: string } | { ok: false; error: string }

const MIN_PASSWORD = 10

/** Set a new password for the signed-in user (after a reset link signed them in). */
export async function setNewPassword(password: string, confirm: string): Promise<SetPasswordResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Your reset link has expired. Ask for a new one.' }
  if ((password ?? '').length < MIN_PASSWORD) return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` }
  if (password !== confirm) return { ok: false, error: 'The two passwords do not match.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }

  const profile = await getCurrentProfile(supabase).catch(() => null)
  return { ok: true, next: roleIsSales(profile?.role) ? '/sales/dashboard' : '/dashboard' }
}
