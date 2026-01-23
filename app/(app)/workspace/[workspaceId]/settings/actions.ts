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

export async function updateSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  const brandFilter = String(formData.get('brand_filter') ?? '').trim()
  const currencySymbol = String(formData.get('currency_symbol') ?? '$').trim()
  const cogsPct = Number(formData.get('cogs_pct'))
  const promoCost = Number(formData.get('promo_cost'))

  if (!workspaceId) {
    return { error: 'Workspace id is required.' }
  }

  if (Number.isNaN(cogsPct) || Number.isNaN(promoCost)) {
    return { error: 'COGS and promo cost must be numbers.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('workspace_settings').upsert({
    workspace_id: workspaceId,
    brand_filter: brandFilter,
    cogs_pct: cogsPct,
    promo_cost: promoCost,
    currency_symbol: currencySymbol,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/workspace/${workspaceId}/settings`)
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

  const supabase = createClient()
  const { error } = await supabase.from('customer_mappings').insert({
    workspace_id: workspaceId,
    sell_in_customer: sellInCustomer,
    sell_out_company: sellOutCompany,
    group_name: groupName || null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/workspace/${workspaceId}/settings`)
  return { success: true }
}

export async function deleteMapping(formData: FormData) {
  const workspaceId = String(formData.get('workspaceId') ?? '').trim()
  const mappingId = String(formData.get('mappingId') ?? '').trim()

  if (!workspaceId || !mappingId) {
    return
  }

  const supabase = createClient()
  await supabase
    .from('customer_mappings')
    .delete()
    .eq('id', mappingId)
    .eq('workspace_id', workspaceId)

  revalidatePath(`/workspace/${workspaceId}/settings`)
}
