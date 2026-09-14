import { createClient } from '@/lib/supabase/server'
import { normaliseIban } from '@/lib/remittance'
import type { RemittanceAccount } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

/** Every account, active or not, for the Settings table. Grouped client-side. */
export async function listRemittanceAccounts(client?: SupabaseClient): Promise<RemittanceAccount[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('remittance_accounts')
    .select('*')
    .order('currency')
    .order('sort_order')
    .order('label')
  if (error) throw new Error(error.message || 'Failed to load remittance accounts')
  return (data ?? []) as RemittanceAccount[]
}

/** Active accounts for one currency, in print order, for the PDF and email. */
export async function getRemittanceAccountsForCurrency(
  currency: string,
  client?: SupabaseClient
): Promise<RemittanceAccount[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('remittance_accounts')
    .select('*')
    .eq('currency', currency.toUpperCase())
    .eq('active', true)
    .order('sort_order')
    .order('label')
  if (error) throw new Error(error.message || 'Failed to load remittance accounts')
  return (data ?? []) as RemittanceAccount[]
}

type WriteInput = Partial<Omit<RemittanceAccount, 'id' | 'created_at' | 'updated_at'>>

function cleanPayload(input: WriteInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  for (const key of ['currency', 'rail', 'label', 'beneficiary_name'] as const) {
    if (key in input) out[key] = text(input[key])
  }
  for (const key of ['beneficiary_address', 'bank_name', 'bank_address', 'bic', 'intermediary_bic', 'account_number', 'account_type', 'notes'] as const) {
    if (key in input) out[key] = text(input[key])
  }
  if ('iban' in input) out.iban = input.iban?.trim() ? normaliseIban(input.iban) : null
  if ('bic' in input && out.bic) out.bic = String(out.bic).toUpperCase()
  if ('intermediary_bic' in input && out.intermediary_bic) out.intermediary_bic = String(out.intermediary_bic).toUpperCase()
  if ('sort_code' in input) out.sort_code = input.sort_code?.trim() ? input.sort_code.replace(/[-\s]/g, '') : null
  if ('routing_number' in input) out.routing_number = text(input.routing_number)
  if ('sort_order' in input) out.sort_order = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0
  if ('active' in input) out.active = input.active !== false
  return out
}

export async function createRemittanceAccount(input: WriteInput, client?: SupabaseClient): Promise<RemittanceAccount> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('remittance_accounts').insert(cleanPayload(input)).select('*').single()
  if (error) throw new Error(error.message || 'Failed to create remittance account')
  return data as RemittanceAccount
}

export async function updateRemittanceAccount(id: string, input: WriteInput, client?: SupabaseClient): Promise<RemittanceAccount> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('remittance_accounts').update(cleanPayload(input)).eq('id', id).select('*').single()
  if (error) throw new Error(error.message || 'Failed to update remittance account')
  return data as RemittanceAccount
}

export async function deleteRemittanceAccount(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('remittance_accounts').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete remittance account')
}
