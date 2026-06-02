import { createClient } from '@/lib/supabase/server'
import type { ApprovalRequest, ApprovalRequestWithRelations, ApprovalStatus, ApprovalType } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const SELECT = '*, approver:contacts(id,name,email)'

export async function listApprovals(engagementId: string, client?: SupabaseClient): Promise<ApprovalRequestWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('approval_requests')
    .select(SELECT)
    .eq('engagement_id', engagementId)
    .order('requested_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load approvals')
  return (data ?? []) as unknown as ApprovalRequestWithRelations[]
}

export interface ApprovalInput {
  engagement_id: string
  type: ApprovalType
  amount?: number | null
  currency?: string
  description?: string | null
  approver_id?: string | null
  related_entity_type?: ApprovalRequest['related_entity_type']
  related_entity_id?: string | null
}

export async function createApproval(input: ApprovalInput, client?: SupabaseClient): Promise<ApprovalRequest> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      engagement_id: input.engagement_id,
      requester_id: auth.data.user?.id ?? null,
      approver_id: input.approver_id ?? null,
      type: input.type,
      amount: input.amount ?? null,
      currency: input.currency ?? 'GBP',
      description: input.description ?? null,
      related_entity_type: input.related_entity_type ?? null,
      related_entity_id: input.related_entity_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create approval request')
  return data as ApprovalRequest
}

export async function decideApproval(id: string, status: 'Approved' | 'Declined', notes: string | null, client?: SupabaseClient): Promise<ApprovalRequest> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('approval_requests')
    .update({ status, decided_at: new Date().toISOString(), decision_notes: notes })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to update approval')
  return data as ApprovalRequest
}

export async function withdrawApproval(id: string, client?: SupabaseClient): Promise<ApprovalRequest> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('approval_requests')
    .update({ status: 'Withdrawn' as ApprovalStatus, decided_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to withdraw approval')
  return data as ApprovalRequest
}

export async function setApprovalThread(id: string, threadId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('approval_requests').update({ gmail_thread_id: threadId }).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to link approval thread')
}

export async function getApproval(id: string, client?: SupabaseClient): Promise<ApprovalRequestWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('approval_requests').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load approval')
  return (data as unknown as ApprovalRequestWithRelations | null) ?? null
}

/**
 * Heuristic: flip Open approvals whose linked thread received an inbound reply
 * containing "approved"/"declined". Called from the Gmail sync.
 * `replies` are inbound messages keyed by thread id + text.
 */
export async function applyInboundApprovalReplies(
  replies: Array<{ gmail_thread_id: string; body_text: string | null }>,
  client?: SupabaseClient
): Promise<number> {
  const supabase = await getSupabase(client)
  const threadIds = Array.from(new Set(replies.map((r) => r.gmail_thread_id).filter(Boolean)))
  if (threadIds.length === 0) return 0

  const { data: open } = await supabase
    .from('approval_requests')
    .select('id, gmail_thread_id')
    .eq('status', 'Open')
    .in('gmail_thread_id', threadIds)
  if (!open || open.length === 0) return 0

  const byThread = new Map<string, string>() // thread -> approval id
  for (const a of open as Array<{ id: string; gmail_thread_id: string }>) byThread.set(a.gmail_thread_id, a.id)

  let flipped = 0
  for (const r of replies) {
    const approvalId = byThread.get(r.gmail_thread_id)
    if (!approvalId) continue
    const text = (r.body_text || '').toLowerCase()
    const decided: 'Approved' | 'Declined' | null = /\bapproved?\b|\byes\b/.test(text) ? 'Approved' : /\bdeclined?\b|\brejected?\b|\bno\b/.test(text) ? 'Declined' : null
    if (!decided) continue
    await supabase
      .from('approval_requests')
      .update({ status: decided, decided_at: new Date().toISOString(), decision_notes: 'Auto-matched from email reply (review the thread).' })
      .eq('id', approvalId)
      .eq('status', 'Open')
    byThread.delete(r.gmail_thread_id)
    flipped++
  }
  return flipped
}
