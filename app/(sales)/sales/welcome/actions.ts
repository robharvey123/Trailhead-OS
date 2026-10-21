'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile, roleIsSales } from '@/lib/auth/roles'

export type SetupResult = { ok: true } | { ok: false; error: string }

const MIN_PASSWORD = 10

/** First sign-in for the Sales Lead seat: confirm the display name and choose a password. */
export async function completeSalesSetup(input: { displayName: string; password: string }): Promise<SetupResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!user || !profile || !roleIsSales(profile.role)) return { ok: false, error: 'Open your sign-in link again, then finish setting up.' }

  const displayName = (input.displayName ?? '').trim()
  const password = input.password ?? ''
  if (!displayName) return { ok: false, error: 'Enter your name.' }
  if (displayName.length > 80) return { ok: false, error: 'Keep your name under 80 characters.' }
  if (password.length < MIN_PASSWORD) return { ok: false, error: `Use at least ${MIN_PASSWORD} characters for your password.` }

  const { error: pwError } = await supabase.auth.updateUser({ password, data: { full_name: displayName } })
  if (pwError) return { ok: false, error: pwError.message }

  const { error: nameError } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
  if (nameError) return { ok: false, error: 'Password saved, but your name did not. Try again.' }

  // Audit trail: the invite is claimed once the seat has set itself up.
  if (user.email) {
    await createAdminClient()
      .from('invites')
      .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
      .eq('role', 'sales')
      .ilike('email', user.email)
      .is('claimed_at', null)
  }
  return { ok: true }
}
