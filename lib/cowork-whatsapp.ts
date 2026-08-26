// Cowork-facing WhatsApp helpers: live capture and reads. Service client, bearer
// auth at the route. client_visible has NO write path here — these are private
// commercial conversations and the report generator reads client-visible rows.

import { supabaseService } from '@/lib/supabase/service'
import { CoworkApiError, optionalString, requiredString } from '@/lib/cowork-api'
import { normaliseParticipantName } from '@/lib/whatsapp/normalise'
import { captureMessageId } from '@/lib/whatsapp/ids'
import { listMessages, type ListMessagesOptions } from '@/lib/db/whatsapp'
import type { WhatsAppMessage, WhatsAppMessageType, WhatsAppPrecision } from '@/lib/types'

type ConversationRow = {
  id: string
  title: string
  is_group: boolean
  account_id: string | null
  engagement_id: string | null
  is_personal: boolean
  whatsapp_participants: Array<{ id: string; display_name: string; normalised_name: string; contact_id: string | null; is_self: boolean; left_at: string | null }>
}

const CONV_SELECT = 'id, title, is_group, account_id, engagement_id, is_personal, whatsapp_participants(id, display_name, normalised_name, contact_id, is_self, left_at)'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRECISIONS = new Set<WhatsAppPrecision>(['exact', 'minute', 'day'])
const TYPES = new Set<WhatsAppMessageType>(['text', 'media', 'system'])
export const MAX_BATCH = 100

function candidateSummary(c: ConversationRow) {
  return {
    id: c.id,
    title: c.title,
    is_group: c.is_group,
    participants: c.whatsapp_participants.map((p) => p.display_name),
  }
}

/** Resolve by id, or by exact (case-insensitive) title. Ambiguous title → 409 with candidates, nothing written. */
async function resolveConversation(id: string | null, title: string | null): Promise<ConversationRow> {
  if (id) {
    if (!UUID_RE.test(id)) throw new CoworkApiError('conversation_id must be a uuid', 400)
    const { data, error } = await supabaseService.from('whatsapp_conversations').select(CONV_SELECT).eq('id', id).maybeSingle()
    if (error) throw new CoworkApiError(error.message, 500)
    if (!data) throw new CoworkApiError(`Conversation not found: ${id}`, 404)
    return data as unknown as ConversationRow
  }
  if (!title) throw new CoworkApiError('conversation_id or conversation_title is required', 400)
  const { data, error } = await supabaseService.from('whatsapp_conversations').select(CONV_SELECT).ilike('title', title.trim())
  if (error) throw new CoworkApiError(error.message, 500)
  const rows = (data ?? []) as unknown as ConversationRow[]
  if (rows.length === 0) throw new CoworkApiError(`No conversation titled "${title}"`, 404)
  if (rows.length > 1) {
    throw new CoworkApiError(`Conversation title "${title}" is ambiguous; pass conversation_id`, 409, { candidates: rows.map(candidateSummary) })
  }
  return rows[0]
}

/**
 * Resolve the sender against the conversation's participants. An unknown sender
 * in a known conversation is a 409, never an auto-create: someone new in the
 * group is a fact worth surfacing, not something to guess at.
 */
function resolveSender(conv: ConversationRow, sender: string | null, senderContactId: string | null, direction: string | null) {
  const parts = conv.whatsapp_participants
  const self = parts.find((p) => p.is_self) ?? null
  if (senderContactId) {
    const p = parts.find((x) => x.contact_id === senderContactId)
    if (!p) throw new CoworkApiError(`No participant in "${conv.title}" is mapped to contact ${senderContactId}`, 409, { participants: parts.map((x) => x.display_name) })
    return p
  }
  if (sender) {
    const key = normaliseParticipantName(sender)
    const p = parts.find((x) => x.normalised_name === key)
    if (!p) throw new CoworkApiError(`Unknown sender "${sender}" in "${conv.title}". Map them in the OS first.`, 409, { participants: parts.map((x) => x.display_name) })
    return p
  }
  if (direction === 'inbound') {
    const others = parts.filter((p) => !p.is_self)
    if (others.length === 1) return others[0]
    throw new CoworkApiError('sender is required for inbound messages in a group conversation', 400, { participants: parts.map((x) => x.display_name) })
  }
  if (!self) throw new CoworkApiError(`"${conv.title}" has no participant marked as you; pass sender`, 409, { participants: parts.map((x) => x.display_name) })
  return self
}

export interface CaptureInput {
  conversation_id?: string
  conversation_title?: string
  sender?: string
  sender_contact_id?: string
  direction?: 'inbound' | 'outbound'
  body: string
  occurred_at?: string
  occurred_at_precision?: WhatsAppPrecision
  is_draft?: boolean
  type?: WhatsAppMessageType
  media_filename?: string
}

type PreparedRow = {
  row: Record<string, unknown>
  conversation: ConversationRow
}

function prepare(raw: unknown, index: number): Promise<PreparedRow> {
  return (async () => {
    if (!raw || typeof raw !== 'object') throw new CoworkApiError(`Item ${index}: body must be an object`, 400)
    const b = raw as Record<string, unknown>
    const conv = await resolveConversation(optionalString(b.conversation_id), optionalString(b.conversation_title))
    const direction = optionalString(b.direction)
    if (direction && direction !== 'inbound' && direction !== 'outbound') throw new CoworkApiError(`Item ${index}: direction must be inbound or outbound`, 400)
    const participant = resolveSender(conv, optionalString(b.sender), optionalString(b.sender_contact_id), direction)

    const body = requiredString(b.body, 'body')
    const occurredAt = b.occurred_at === undefined || b.occurred_at === null || b.occurred_at === '' ? new Date().toISOString() : new Date(String(b.occurred_at)).toISOString()
    if (Number.isNaN(new Date(occurredAt).getTime())) throw new CoworkApiError(`Item ${index}: occurred_at must be an ISO datetime`, 400)
    const precision = (optionalString(b.occurred_at_precision) ?? 'minute') as WhatsAppPrecision
    if (!PRECISIONS.has(precision)) throw new CoworkApiError(`Item ${index}: occurred_at_precision must be exact, minute or day`, 400)
    const type = (optionalString(b.type) ?? 'text') as WhatsAppMessageType
    if (!TYPES.has(type)) throw new CoworkApiError(`Item ${index}: type must be text, media or system`, 400)
    const isDraft = b.is_draft === undefined ? false : Boolean(b.is_draft)
    if (isDraft && !participant.is_self) throw new CoworkApiError(`Item ${index}: only your own replies can be drafts`, 400)

    return {
      conversation: conv,
      row: {
        wa_message_id: captureMessageId(conv.id, occurredAt, participant.display_name, body),
        conversation_id: conv.id,
        sender_participant_id: participant.id,
        direction: participant.is_self ? 'outbound' : 'inbound',
        display_name: participant.display_name,
        contact_id: participant.contact_id,
        account_id: conv.account_id,
        engagement_id: conv.engagement_id,
        type,
        body,
        media_filename: optionalString(b.media_filename),
        source: 'cowork_capture',
        is_personal: conv.is_personal,
        client_visible: false, // no write path, ever
        is_draft: isDraft,
        occurred_at: occurredAt,
        occurred_at_precision: precision,
      },
    }
  })()
}

export interface CaptureResult {
  message: WhatsAppMessage
  deduped: boolean
}

/** Validate every item before writing any. Unique violation → the existing row, deduped: true. */
export async function captureMessages(items: unknown[]): Promise<CaptureResult[]> {
  if (items.length === 0) throw new CoworkApiError('At least one message is required', 400)
  if (items.length > MAX_BATCH) throw new CoworkApiError(`At most ${MAX_BATCH} messages per call`, 400)
  const prepared: PreparedRow[] = []
  for (let i = 0; i < items.length; i++) prepared.push(await prepare(items[i], i))

  const results: CaptureResult[] = []
  const latestByConv = new Map<string, string>()
  for (const { row, conversation } of prepared) {
    const { data, error } = await supabaseService.from('whatsapp_messages').insert(row).select('*').single()
    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: exErr } = await supabaseService.from('whatsapp_messages').select('*').eq('wa_message_id', row.wa_message_id as string).single()
        if (exErr || !existing) throw new CoworkApiError(exErr?.message ?? 'Duplicate message could not be re-read', 500)
        results.push({ message: existing as WhatsAppMessage, deduped: true })
        continue
      }
      throw new CoworkApiError(error.message, 500)
    }
    results.push({ message: data as WhatsAppMessage, deduped: false })
    const at = row.occurred_at as string
    const cur = latestByConv.get(conversation.id)
    if (!cur || at > cur) latestByConv.set(conversation.id, at)
  }
  for (const [convId, at] of latestByConv) {
    await supabaseService.from('whatsapp_conversations').update({ last_message_at: at }).eq('id', convId).or(`last_message_at.is.null,last_message_at.lt.${at}`)
  }
  return results
}

export interface PatchInput {
  body?: string
  is_draft?: boolean
  client_visible?: boolean
  occurred_at?: string
  occurred_at_precision?: WhatsAppPrecision
}

/** Amend a captured row. A body change recomputes wa_message_id — what was actually sent is the record. */
export async function patchMessage(id: string, raw: unknown): Promise<{ message: WhatsAppMessage; before: WhatsAppMessage }> {
  if (!UUID_RE.test(id)) throw new CoworkApiError('id must be a uuid', 400)
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const { data: before, error: beforeErr } = await supabaseService.from('whatsapp_messages').select('*').eq('id', id).maybeSingle()
  if (beforeErr) throw new CoworkApiError(beforeErr.message, 500)
  if (!before) throw new CoworkApiError(`Message not found: ${id}`, 404)
  const prev = before as WhatsAppMessage

  const patch: Record<string, unknown> = {}
  if (b.body !== undefined) patch.body = requiredString(b.body, 'body')
  if (b.is_draft !== undefined) patch.is_draft = Boolean(b.is_draft)
  if (b.client_visible !== undefined) patch.client_visible = Boolean(b.client_visible)
  if (b.occurred_at !== undefined) {
    const d = new Date(String(b.occurred_at))
    if (Number.isNaN(d.getTime())) throw new CoworkApiError('occurred_at must be an ISO datetime', 400)
    patch.occurred_at = d.toISOString()
  }
  if (b.occurred_at_precision !== undefined) {
    const p = String(b.occurred_at_precision) as WhatsAppPrecision
    if (!PRECISIONS.has(p)) throw new CoworkApiError('occurred_at_precision must be exact, minute or day', 400)
    patch.occurred_at_precision = p
  }
  if (Object.keys(patch).length === 0) throw new CoworkApiError('No recognised fields: body, is_draft, client_visible, occurred_at, occurred_at_precision', 400)

  if ((patch.body !== undefined && patch.body !== prev.body) || (patch.occurred_at !== undefined && patch.occurred_at !== prev.occurred_at)) {
    if (prev.source === 'cowork_capture') {
      patch.wa_message_id = captureMessageId(prev.conversation_id, (patch.occurred_at as string) ?? prev.occurred_at, prev.display_name ?? '', (patch.body as string) ?? prev.body ?? '')
    }
  }

  const { data, error } = await supabaseService.from('whatsapp_messages').update(patch).eq('id', id).select('*').single()
  if (error) {
    if (error.code === '23505') throw new CoworkApiError('Another row already holds that exact message', 409)
    throw new CoworkApiError(error.message, 500)
  }
  return { message: data as WhatsAppMessage, before: prev }
}

export interface ListFilters {
  conversationId?: string
  contactId?: string
  accountId?: string
  engagementId?: string
  since?: string
  limit: number
  includeDrafts: boolean
}

export interface CoworkWhatsAppMessage extends WhatsAppMessage {
  sender: string | null
  conversation: { id: string; title: string; is_group: boolean; engagement_id: string | null; account_id: string | null }
}

/** Messages newest first across the matching conversations, with sender and conversation expanded. */
export async function listCoworkMessages(f: ListFilters): Promise<{ conversations: Array<{ id: string; title: string; is_group: boolean; participants: string[] }>; messages: CoworkWhatsAppMessage[] }> {
  let convIds: string[] | null = null
  const union = (ids: string[]) => {
    convIds = convIds === null ? ids : convIds.filter((id) => ids.includes(id))
  }

  if (f.conversationId) {
    if (!UUID_RE.test(f.conversationId)) throw new CoworkApiError('conversation_id must be a uuid', 400)
    union([f.conversationId])
  }
  if (f.engagementId) {
    const { data, error } = await supabaseService.from('whatsapp_conversations').select('id').eq('engagement_id', f.engagementId)
    if (error) throw new CoworkApiError(error.message, 500)
    union((data ?? []).map((r) => r.id as string))
  }
  if (f.contactId) {
    const { data, error } = await supabaseService.from('whatsapp_participants').select('conversation_id').eq('contact_id', f.contactId)
    if (error) throw new CoworkApiError(error.message, 500)
    union(Array.from(new Set((data ?? []).map((r) => r.conversation_id as string))))
  }
  if (f.accountId) {
    const [direct, contacts] = await Promise.all([
      supabaseService.from('whatsapp_conversations').select('id').eq('account_id', f.accountId),
      supabaseService.from('contacts').select('id').eq('account_id', f.accountId),
    ])
    if (direct.error) throw new CoworkApiError(direct.error.message, 500)
    const ids = new Set((direct.data ?? []).map((r) => r.id as string))
    const contactIds = (contacts.data ?? []).map((r) => r.id as string)
    if (contactIds.length) {
      const { data } = await supabaseService.from('whatsapp_participants').select('conversation_id').in('contact_id', contactIds)
      for (const r of data ?? []) ids.add(r.conversation_id as string)
    }
    union([...ids])
  }

  let convQuery = supabaseService.from('whatsapp_conversations').select(CONV_SELECT).order('last_message_at', { ascending: false, nullsFirst: false })
  if (convIds !== null) {
    if ((convIds as string[]).length === 0) return { conversations: [], messages: [] }
    convQuery = convQuery.in('id', convIds)
  }
  const { data: convData, error: convErr } = await convQuery
  if (convErr) throw new CoworkApiError(convErr.message, 500)
  const convs = (convData ?? []) as unknown as ConversationRow[]
  if (convs.length === 0) return { conversations: [], messages: [] }
  const byId = new Map(convs.map((c) => [c.id, c]))
  const participantName = new Map<string, string>()
  for (const c of convs) for (const p of c.whatsapp_participants) participantName.set(p.id, p.display_name)

  let q = supabaseService
    .from('whatsapp_messages')
    .select('*')
    .in('conversation_id', convs.map((c) => c.id))
    .order('occurred_at', { ascending: false })
    .limit(f.limit)
  if (!f.includeDrafts) q = q.eq('is_draft', false)
  if (f.since) q = q.gte('occurred_at', f.since)
  const { data, error } = await q
  if (error) throw new CoworkApiError(error.message, 500)

  const messages = ((data ?? []) as WhatsAppMessage[]).map((m) => {
    const c = byId.get(m.conversation_id)!
    return {
      ...m,
      sender: m.sender_participant_id ? participantName.get(m.sender_participant_id) ?? m.display_name : m.display_name,
      conversation: { id: c.id, title: c.title, is_group: c.is_group, engagement_id: c.engagement_id, account_id: c.account_id },
    }
  })
  return {
    conversations: convs.map((c) => ({ id: c.id, title: c.title, is_group: c.is_group, participants: c.whatsapp_participants.map((p) => p.display_name) })),
    messages,
  }
}

export { listMessages }
export type { ListMessagesOptions }
