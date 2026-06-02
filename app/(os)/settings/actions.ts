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