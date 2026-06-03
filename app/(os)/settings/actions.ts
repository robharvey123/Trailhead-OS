'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
 * Updates the signed-in user's own display name. Role is intentionally NOT
 * updatable here (RLS + a DB trigger also block self-elevation).
 */
export async function updateDisplayName(_prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const displayName = String(formData.get('display_name') ?? '').trim()
  if (!displayName) return { error: 'Display name is required' }
  const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}