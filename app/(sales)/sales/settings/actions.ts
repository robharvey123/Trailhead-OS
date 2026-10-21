'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile, roleCanUseSales, roleIsAdmin } from '@/lib/auth/roles'
import { checkSenderAddress } from '@/lib/sales/sender'

export type SettingsResult = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function saveSenderIdentity(input: { fromName: string; fromEmail: string; replyTo: string }): Promise<SettingsResult> {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!profile || !roleCanUseSales(profile.role)) return { ok: false, error: 'Sign in to the sales seat first.' }

  const fromName = input.fromName.trim()
  const fromEmail = input.fromEmail.trim().toLowerCase()
  const replyTo = input.replyTo.trim().toLowerCase()
  if (!fromName || fromName.length > 80) return { ok: false, error: 'Enter a from name (up to 80 characters).' }
  if (/[<>"\r\n]/.test(fromName)) return { ok: false, error: 'The from name cannot contain < > " or line breaks.' }
  if (replyTo && !EMAIL_RE.test(replyTo)) return { ok: false, error: 'Enter a valid reply-to address, or leave it blank.' }

  const check = await checkSenderAddress(createAdminClient(), fromEmail)
  if (!check.ok) return check

  const { error } = await supabase.from('user_sender_identities').upsert(
    { user_id: profile.id, from_name: fromName, from_email: fromEmail, reply_to: replyTo || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) return { ok: false, error: 'Could not save your sender identity.' }
  revalidatePath('/sales/settings')
  return { ok: true }
}

/** Owner/admin only: the domains personal sender identities may use. */
export async function saveSendingDomains(raw: string): Promise<SettingsResult> {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!profile || !roleIsAdmin(profile.role)) return { ok: false, error: 'Only an owner or admin can change sending domains.' }
  const domains = Array.from(new Set(raw.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean)))
  const bad = domains.find((d) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d))
  if (bad) return { ok: false, error: `${bad} is not a domain name.` }
  const { error } = await supabase.from('os_company_settings').update({ verified_sending_domains: domains }).eq('key', 'default')
  if (error) return { ok: false, error: 'Could not save the sending domains.' }
  revalidatePath('/sales/settings')
  return { ok: true }
}
