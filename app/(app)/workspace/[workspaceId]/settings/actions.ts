'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SettingsState = {
  error?: string
  success?: boolean
}

export type MappingState = {
  error?: string
  success?: boolean
}

function revalidateSettingsPaths(workspaceId: string) {
  revalidatePath(`/analytics/${workspaceId}/settings`)
  revalidatePath(`/workspace/${workspaceId}/settings`)
}

export async function updateSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  const brandFilter = String(formData.get('brand_filter') ?? '').trim()
  const baseCurrency = String(formData.get('base_currency') ?? 'GBP').trim()
  const supportedCurrencies = formData.getAll('supported_currencies').map(String).filter(Boolean)
  const cogsPct = Number(formData.get('cogs_pct'))
  const promoCost = Number(formData.get('promo_cost'))

  if (!workspaceId) {
    return { error: 'Workspace id is required.' }
  }

  if (Number.isNaN(cogsPct) || Number.isNaN(promoCost)) {
    return { error: 'COGS and promo cost must be numbers.' }
  }

  const supabase = await createClient()
  if (!supportedCurrencies.includes(baseCurrency)) {
    supportedCurrencies.unshift(baseCurrency)
  }

  const { error } = await supabase.from('workspace_settings').upsert({
    workspace_id: workspaceId,
    brand_filter: brandFilter,
    cogs_pct: cogsPct,
    promo_cost: promoCost,
    base_currency: baseCurrency,
    supported_currencies: supportedCurrencies,
  })

  if (error) {
    return { error: error.message }
  }

  revalidateSettingsPaths(workspaceId)
  return { success: true }
}

export async function addMapping(
  _prevState: MappingState,
  formData: FormData
): Promise<MappingState> {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  const sellInCustomer = String(formData.get('sell_in_customer') ?? '').trim()
  const sellOutCompany = String(formData.get('sell_out_company') ?? '').trim()
  const groupName = String(formData.get('group_name') ?? '').trim()

  if (!workspaceId || !sellInCustomer || !sellOutCompany) {
    return { error: 'Customer and company are required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('customer_mappings').insert({
    workspace_id: workspaceId,
    sell_in_customer: sellInCustomer,
    sell_out_company: sellOutCompany,
    group_name: groupName || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidateSettingsPaths(workspaceId)
  return { success: true }
}

export async function deleteMapping(formData: FormData) {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  const mappingId = String(formData.get('mappingId') ?? '').trim()

  if (!workspaceId || !mappingId) {
    return
  }

  const supabase = await createClient()
  await supabase
    .from('customer_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('workspace_id', workspaceId)

  revalidateSettingsPaths(workspaceId)
}

export async function updateCompanyDetails(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  if (!workspaceId) return { error: 'Workspace id is required.' }

  const supabase = await createClient()

  const { error } = await supabase.from('workspace_settings').upsert({
    workspace_id: workspaceId,
    company_name: String(formData.get('company_name') ?? '').trim() || null,
    company_address: String(formData.get('company_address') ?? '').trim() || null,
    company_city: String(formData.get('company_city') ?? '').trim() || null,
    company_postcode: String(formData.get('company_postcode') ?? '').trim() || null,
    company_country: String(formData.get('company_country') ?? '').trim() || null,
    company_email: String(formData.get('company_email') ?? '').trim() || null,
    company_phone: String(formData.get('company_phone') ?? '').trim() || null,
    company_vat_number: String(formData.get('company_vat_number') ?? '').trim() || null,
    company_number: String(formData.get('company_number') ?? '').trim() || null,
    bank_name: String(formData.get('bank_name') ?? '').trim() || null,
    bank_account_name: String(formData.get('bank_account_name') ?? '').trim() || null,
    bank_sort_code: String(formData.get('bank_sort_code') ?? '').trim() || null,
    bank_account_number: String(formData.get('bank_account_number') ?? '').trim() || null,
    bank_iban: String(formData.get('bank_iban') ?? '').trim() || null,
    bank_swift: String(formData.get('bank_swift') ?? '').trim() || null,
  })

  if (error) return { error: error.message }

  revalidateSettingsPaths(workspaceId)
  return { success: true }
}
