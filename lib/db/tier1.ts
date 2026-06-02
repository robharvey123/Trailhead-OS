import { createClient } from '@/lib/supabase/server'
import type { Tier1Milestone, Tier1MilestoneWithAccount } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const SELECT = '*, account:accounts(id,name,channel)'

export async function listMilestones(engagementId: string, client?: SupabaseClient): Promise<Tier1MilestoneWithAccount[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('tier1_milestones')
    .select(SELECT)
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load milestones')
  return (data ?? []) as unknown as Tier1MilestoneWithAccount[]
}

export async function upsertMilestone(
  input: { engagementId: string; accountId: string; performanceFee?: number | null },
  client?: SupabaseClient
): Promise<Tier1Milestone> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('tier1_milestones')
    .upsert(
      { engagement_id: input.engagementId, account_id: input.accountId, performance_fee: input.performanceFee ?? null },
      { onConflict: 'engagement_id,account_id' }
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to upsert milestone')
  return data as Tier1Milestone
}

/** Set the three date fields (and/or fee/notes). The DB trigger stamps completed_at. */
export async function updateMilestone(
  id: string,
  patch: Partial<Pick<Tier1Milestone, 'range_review_decided_at' | 'go_live_confirmed_at' | 'first_po_received_at' | 'performance_fee' | 'notes'>>,
  client?: SupabaseClient
): Promise<Tier1Milestone> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('tier1_milestones').update(patch).eq('id', id).select('*').single()
  if (error) throw new Error(error.message || 'Failed to update milestone')
  return data as Tier1Milestone
}

export async function invoiceableMilestones(engagementId: string, client?: SupabaseClient): Promise<Tier1MilestoneWithAccount[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('tier1_milestones')
    .select(SELECT)
    .eq('engagement_id', engagementId)
    .eq('is_complete', true)
    .is('fee_invoice_id', null)
  if (error) throw new Error(error.message || 'Failed to load invoiceable milestones')
  return (data ?? []) as unknown as Tier1MilestoneWithAccount[]
}

export async function markMilestoneInvoiced(milestoneId: string, invoiceId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('tier1_milestones').update({ fee_invoice_id: invoiceId }).eq('id', milestoneId)
  if (error) throw new Error(error.message || 'Failed to mark milestone invoiced')
}

export async function getMilestone(id: string, client?: SupabaseClient): Promise<Tier1MilestoneWithAccount | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('tier1_milestones').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load milestone')
  return (data as unknown as Tier1MilestoneWithAccount | null) ?? null
}
