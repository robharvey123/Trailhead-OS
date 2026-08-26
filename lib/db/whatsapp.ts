import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type {
  WhatsAppConversationWithMessages,
  WhatsAppConversationWithRelations,
  WhatsAppMessage,
  WhatsAppParticipantWithContact,
} from '@/lib/types'

// Reads are conversation-scoped. A group conversation appears on every
// participant's contact page, on the accounts of those contacts, and on the
// engagement it is filed under — that is the payoff of not filing messages
// against one arbitrary contact.

async function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ?? ((await createClient()) as unknown as SupabaseClient)
}

const CONVERSATION_SELECT =
  '*, account:accounts!account_id(id,name), engagement:engagements!engagement_id(id,name,code), participants:whatsapp_participants(*, contact:contacts(id,name,account_id))'

type RawConversation = Record<string, unknown> & {
  account?: { id: string; name: string } | null
  engagement?: { id: string; name: string; code: string | null } | null
  participants?: WhatsAppParticipantWithContact[] | null
}

function normalise(row: RawConversation): WhatsAppConversationWithRelations {
  const { account, engagement, participants, ...rest } = row
  const sorted = [...(participants ?? [])].sort((a, b) => Number(b.is_self) - Number(a.is_self) || a.display_name.localeCompare(b.display_name))
  return {
    ...(rest as unknown as WhatsAppConversationWithRelations),
    account: account ?? null,
    engagement: engagement ?? null,
    participants: sorted,
    message_count: 0,
  }
}

async function loadConversations(ids: string[], supabase: SupabaseClient): Promise<WhatsAppConversationWithRelations[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select(CONVERSATION_SELECT)
    .in('id', ids)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message || 'Failed to load WhatsApp conversations')
  const rows = (data ?? []).map((r) => normalise(r as RawConversation))
  await Promise.all(
    rows.map(async (c) => {
      const { count } = await supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('is_draft', false)
      c.message_count = count ?? 0
    })
  )
  return rows
}

export interface ListMessagesOptions {
  includeDrafts?: boolean
  limit?: number
  /** ISO — only messages strictly before this instant. */
  before?: string
  /** ISO — only messages at or after this instant. */
  since?: string
}

/** Newest first. Drafts excluded unless asked for. */
export async function listMessages(conversationId: string, opts: ListMessagesOptions = {}, client?: SupabaseClient): Promise<WhatsAppMessage[]> {
  const supabase = await getSupabase(client)
  let q = supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (!opts.includeDrafts) q = q.eq('is_draft', false)
  if (opts.before) q = q.lt('occurred_at', opts.before)
  if (opts.since) q = q.gte('occurred_at', opts.since)
  const { data, error } = await q
  if (error) throw new Error(error.message || 'Failed to load WhatsApp messages')
  return (data ?? []) as WhatsAppMessage[]
}

export async function getConversation(id: string, client?: SupabaseClient): Promise<WhatsAppConversationWithRelations | null> {
  const supabase = await getSupabase(client)
  const rows = await loadConversations([id], supabase)
  return rows[0] ?? null
}

/** Every conversation the contact participates in. */
export async function listConversationsForContact(contactId: string, client?: SupabaseClient): Promise<WhatsAppConversationWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('whatsapp_participants').select('conversation_id').eq('contact_id', contactId)
  if (error) throw new Error(error.message || 'Failed to load WhatsApp conversations')
  const ids = Array.from(new Set((data ?? []).map((r) => r.conversation_id as string)))
  return loadConversations(ids, supabase)
}

/** Conversations filed under the account, plus any where a mapped participant belongs to a contact on it. */
export async function listConversationsForAccount(accountId: string, client?: SupabaseClient): Promise<WhatsAppConversationWithRelations[]> {
  const supabase = await getSupabase(client)
  const [direct, contacts] = await Promise.all([
    supabase.from('whatsapp_conversations').select('id').eq('account_id', accountId),
    supabase.from('contacts').select('id').eq('account_id', accountId),
  ])
  if (direct.error) throw new Error(direct.error.message)
  if (contacts.error) throw new Error(contacts.error.message)
  const ids = new Set((direct.data ?? []).map((r) => r.id as string))
  const contactIds = (contacts.data ?? []).map((r) => r.id as string)
  if (contactIds.length) {
    const { data, error } = await supabase.from('whatsapp_participants').select('conversation_id').in('contact_id', contactIds)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) ids.add(r.conversation_id as string)
  }
  return loadConversations([...ids], supabase)
}

export async function listConversationsForEngagement(engagementId: string, client?: SupabaseClient): Promise<WhatsAppConversationWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('whatsapp_conversations').select('id').eq('engagement_id', engagementId)
  if (error) throw new Error(error.message)
  return loadConversations((data ?? []).map((r) => r.id as string), supabase)
}

/** Attach the most recent messages (newest first) to each conversation, for the detail-page timelines. */
export async function withMessages(
  conversations: WhatsAppConversationWithRelations[],
  opts: ListMessagesOptions = { includeDrafts: true, limit: 500 },
  client?: SupabaseClient
): Promise<WhatsAppConversationWithMessages[]> {
  const supabase = await getSupabase(client)
  return Promise.all(conversations.map(async (c) => ({ ...c, messages: await listMessages(c.id, opts, supabase) })))
}

export interface ImportBatchSummary {
  batch_id: string
  conversation_id: string
  conversation_title: string
  count: number
  first_created_at: string
}

/** Recent import batches, for an undo list. */
export async function listImportBatches(client?: SupabaseClient, limit = 20): Promise<ImportBatchSummary[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('import_batch_id, conversation_id, created_at, conversation:whatsapp_conversations(title)')
    .not('import_batch_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  const map = new Map<string, ImportBatchSummary>()
  for (const r of (data ?? []) as unknown as Array<{ import_batch_id: string; conversation_id: string; created_at: string; conversation: { title: string } | null }>) {
    const cur = map.get(r.import_batch_id)
    if (cur) {
      cur.count++
      if (r.created_at < cur.first_created_at) cur.first_created_at = r.created_at
    } else map.set(r.import_batch_id, { batch_id: r.import_batch_id, conversation_id: r.conversation_id, conversation_title: r.conversation?.title ?? '', count: 1, first_created_at: r.created_at })
  }
  return [...map.values()].slice(0, limit)
}
