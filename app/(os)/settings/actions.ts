'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/roles'
import { disconnectFreeAgent } from '@/lib/freeagent/client'

/** Disconnect the FreeAgent accounting connection (admin only). */
export async function disconnectFreeAgentAction(): Promise<{ error?: string }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  try {
    await disconnectFreeAgent()
    revalidatePath('/settings')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to disconnect' }
  }
}

export type CompanySettingsState = {
  error?: string
  success?: boolean
}

export async function updateOsCompanySettings(
  _prevState: CompanySettingsState,
  formData: FormData
): Promise<CompanySettingsState> {
  const supabase = await createClient()

  const { error } = await supabase.from('os_company_settings').upsert({
    key: 'default',
    company_name: String(formData.get('company_name') ?? '').trim() || 'Trailhead Holdings Ltd',
    address_line1: String(formData.get('address_line1') ?? '').trim() || null,
    address_line2: String(formData.get('address_line2') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    postcode: String(formData.get('postcode') ?? '').trim() || null,
    country: String(formData.get('country') ?? '').trim() || null,
    company_email: String(formData.get('company_email') ?? '').trim() || null,
    company_number: String(formData.get('company_number') ?? '').trim() || null,
    email_signature: String(formData.get('email_signature') ?? '').trim() || null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export type ProfileState = { error?: string; success?: boolean }

/**
 * Updates the signed-in user's own full name. The single value is written to all
 * three identity stores so they never drift: people.full_name (the source of
 * truth), profiles.display_name, and auth.users user_metadata.full_name. Role is
 * intentionally NOT updatable here (RLS + a DB trigger also block self-elevation).
 */
export async function updateDisplayName(_prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const fullName = String(formData.get('full_name') ?? '').trim()
  if (!fullName) return { error: 'Full name is required' }

  // Find the linked person (if any) so we can update the source-of-truth row.
  const { data: profile } = await supabase.from('profiles').select('person_id').eq('id', user.id).maybeSingle()

  // Service role for the three writes — avoids RLS friction and keeps them cohesive.
  const admin = createAdminClient()
  const { error: profileErr } = await admin.from('profiles').update({ display_name: fullName }).eq('id', user.id)
  if (profileErr) return { error: profileErr.message }
  if (profile?.person_id) {
    const { error: personErr } = await admin.from('people').update({ full_name: fullName }).eq('id', profile.person_id)
    if (personErr) return { error: personErr.message }
  }
  const { error: authErr } = await admin.auth.admin.updateUserById(user.id, { user_metadata: { full_name: fullName } })
  if (authErr) return { error: authErr.message }

  revalidatePath('/settings')
  revalidatePath('/my-work')
  return { success: true }
}