'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { normalizeMessage } from './normalize'

export type ChatAttachment = {
  id: string
  message_id: string
  storage_path: string
  file_name: string
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
}

export type ChatMention = { personId: string; fullName: string }

export type ChatMessage = {
  id: string
  sender_id: string | null
  body: string
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  attachments?: ChatAttachment[]
  mentions?: ChatMention[]
}

const ATTACH_COLS = 'id, message_id, storage_path, file_name, mime_type, byte_size, width, height'
const MENTION_COLS = 'mentioned_person_id, person:people(id, full_name)'
const MSG_COLS = `id, sender_id, body, created_at, edited_at, deleted_at, attachments:chat_attachments(${ATTACH_COLS}), mentions:chat_message_mentions(${MENTION_COLS})`

/** Validate that the given person ids exist (RLS lets any authenticated user read people). */
async function existingPersonIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return []
  const { data } = await supabase.from('people').select('id').in('id', unique)
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id)
}

async function authUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Is the caller an admin of this conversation, or a global app admin? */
async function canManage(conversationId: string, userId: string): Promise<boolean> {
  const profile = await getCurrentProfile()
  if (roleIsAdmin(profile?.role)) return true
  const admin = createAdminClient()
  const { data } = await admin
    .from('chat_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.role === 'admin'
}

/** Find or create the 1:1 DM between the caller and otherUserId. */
export async function createDirectMessage(otherUserId: string): Promise<{ id?: string; error?: string }> {
  const user = await authUser()
  if (!user) return { error: 'Not signed in' }
  if (!otherUserId || otherUserId === user.id) return { error: 'Pick a different person to message.' }

  const admin = createAdminClient()

  // Existing DM? Find a 'dm' conversation where both are participants.
  const { data: mine } = await admin
    .from('chat_participants')
    .select('conversation_id, chat_conversations!inner(kind)')
    .eq('user_id', user.id)
  const myDmIds = (mine ?? [])
    .filter((r) => (r.chat_conversations as unknown as { kind: string }).kind === 'dm')
    .map((r) => r.conversation_id as string)
  if (myDmIds.length) {
    const { data: shared } = await admin
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myDmIds)
    if (shared?.length) return { id: shared[0].conversation_id as string }
  }

  const { data: conv, error: convErr } = await admin
    .from('chat_conversations')
    .insert({ kind: 'dm', created_by: user.id })
    .select('id')
    .single()
  if (convErr || !conv) return { error: convErr?.message ?? 'Could not create the conversation.' }

  const { error: partErr } = await admin.from('chat_participants').insert([
    { conversation_id: conv.id, user_id: user.id, role: 'member' },
    { conversation_id: conv.id, user_id: otherUserId, role: 'member' },
  ])
  if (partErr) return { error: partErr.message }
  return { id: conv.id as string }
}

/** Create a named channel with the caller as admin + the given members. */
export async function createChannel(input: { name: string; memberUserIds: string[] }): Promise<{ id?: string; error?: string }> {
  const user = await authUser()
  if (!user) return { error: 'Not signed in' }
  const name = (input.name ?? '').trim()
  if (!name || name.length > 100) return { error: 'Channel name must be 1–100 characters.' }
  const members = Array.from(new Set((input.memberUserIds ?? []).filter((id) => id && id !== user.id)))
  if (members.length === 0) return { error: 'Add at least one other member.' }

  const admin = createAdminClient()
  const { data: conv, error: convErr } = await admin
    .from('chat_conversations')
    .insert({ kind: 'channel', name, created_by: user.id })
    .select('id')
    .single()
  if (convErr || !conv) return { error: convErr?.message ?? 'Could not create the channel.' }

  const rows = [
    { conversation_id: conv.id, user_id: user.id, role: 'admin' },
    ...members.map((id) => ({ conversation_id: conv.id, user_id: id, role: 'member' })),
  ]
  const { error: partErr } = await admin.from('chat_participants').insert(rows)
  if (partErr) return { error: partErr.message }
  return { id: conv.id as string }
}

export async function addParticipants(conversationId: string, userIds: string[]): Promise<{ error?: string }> {
  const user = await authUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await canManage(conversationId, user.id))) return { error: 'Only channel admins can add members.' }
  const ids = Array.from(new Set((userIds ?? []).filter(Boolean)))
  if (ids.length === 0) return {}
  const admin = createAdminClient()
  const { error } = await admin
    .from('chat_participants')
    .upsert(ids.map((id) => ({ conversation_id: conversationId, user_id: id, role: 'member' })), { onConflict: 'conversation_id,user_id', ignoreDuplicates: true })
  if (error) return { error: error.message }
  return {}
}

export async function removeParticipant(conversationId: string, userId: string): Promise<{ error?: string }> {
  const user = await authUser()
  if (!user) return { error: 'Not signed in' }
  if (userId !== user.id && !(await canManage(conversationId, user.id))) {
    return { error: 'Only channel admins can remove members.' }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('chat_participants').delete().eq('conversation_id', conversationId).eq('user_id', userId)
  if (error) return { error: error.message }
  if (userId === user.id) await promoteIfNoAdmin(conversationId)
  return {}
}

export async function leaveConversation(conversationId: string): Promise<{ error?: string }> {
  const user = await authUser()
  if (!user) return { error: 'Not signed in' }
  const admin = createAdminClient()
  const { error } = await admin.from('chat_participants').delete().eq('conversation_id', conversationId).eq('user_id', user.id)
  if (error) return { error: error.message }
  await promoteIfNoAdmin(conversationId)
  return {}
}

/** If a channel is left with no admin, promote the longest-tenured remaining member. */
async function promoteIfNoAdmin(conversationId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: conv } = await admin.from('chat_conversations').select('kind').eq('id', conversationId).maybeSingle()
  if (conv?.kind !== 'channel') return
  const { data: members } = await admin
    .from('chat_participants')
    .select('user_id, role, joined_at')
    .eq('conversation_id', conversationId)
    .order('joined_at', { ascending: true })
  if (!members || members.length === 0) return // orphaned channel — fine for v1
  if (members.some((m) => m.role === 'admin')) return
  await admin.from('chat_participants').update({ role: 'admin' }).eq('conversation_id', conversationId).eq('user_id', members[0].user_id)
}

/**
 * Insert a message. Client passes its optimistic id so the realtime echo dedupes.
 * `mentionPersonIds` are the people the composer explicitly tagged — the server
 * validates they exist and persists one chat_message_mentions row each. The body
 * is NOT parsed for mentions; the composer is the source of truth.
 */
export async function sendMessage(conversationId: string, body: string, messageId?: string, mentionPersonIds: string[] = []): Promise<{ id?: string; created_at?: string; error?: string }> {
  // Empty body is allowed (attachment-only messages); the UI prevents empty body
  // AND no attachments. DB check permits length 0..4000.
  const trimmed = (body ?? '').trim()
  if (trimmed.length > 4000) return { error: 'Message is too long (max 4000 characters).' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const payload: Record<string, unknown> = { conversation_id: conversationId, sender_id: user.id, body: trimmed }
  if (messageId) payload.id = messageId
  const { data, error } = await supabase.from('chat_messages').insert(payload).select('id, created_at').single()
  if (error) return { error: error.message }

  const valid = await existingPersonIds(supabase, mentionPersonIds)
  if (valid.length > 0) {
    await supabase.from('chat_message_mentions').insert(
      valid.map((personId) => ({ message_id: data.id, mentioned_person_id: personId, conversation_id: conversationId }))
    )
  }

  return { id: data.id as string, created_at: data.created_at as string }
}

export async function editMessage(messageId: string, body: string, mentionPersonIds: string[] = []): Promise<{ error?: string }> {
  const trimmed = (body ?? '').trim()
  if (!trimmed) return { error: 'Message is empty.' }
  if (trimmed.length > 4000) return { error: 'Message is too long (max 4000 characters).' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id, conversation_id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Cannot edit — not yours, too old, or already deleted.' }

  // Reconcile mentions: insert newly-added, delete ones the edit removed.
  const conversationId = data[0].conversation_id as string
  const wanted = new Set(await existingPersonIds(supabase, mentionPersonIds))
  const { data: existing } = await supabase
    .from('chat_message_mentions')
    .select('mentioned_person_id')
    .eq('message_id', messageId)
  const current = new Set(((existing ?? []) as Array<{ mentioned_person_id: string }>).map((r) => r.mentioned_person_id))

  const toAdd = [...wanted].filter((id) => !current.has(id))
  const toRemove = [...current].filter((id) => !wanted.has(id))
  if (toAdd.length > 0) {
    await supabase.from('chat_message_mentions').insert(
      toAdd.map((personId) => ({ message_id: messageId, mentioned_person_id: personId, conversation_id: conversationId }))
    )
  }
  if (toRemove.length > 0) {
    await supabase.from('chat_message_mentions').delete().eq('message_id', messageId).in('mentioned_person_id', toRemove)
  }
  return {}
}

export async function deleteMessage(messageId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ deleted_at: new Date().toISOString(), body: '' })
    .eq('id', messageId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Cannot delete — not yours or too old.' }
  return {}
}

/** Idempotent read-cursor bump on the caller's participant row. */
export async function markConversationRead(conversationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
  if (error) return { error: error.message }
  return {}
}

/** Older page of messages (50) before a cursor, ascending. */
export async function loadOlderMessages(conversationId: string, beforeIso: string): Promise<{ messages: ChatMessage[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select(MSG_COLS)
    .eq('conversation_id', conversationId)
    .lt('created_at', beforeIso)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return { messages: [], error: error.message }
  return { messages: ((data ?? []) as unknown as ChatMessage[]).map(normalizeMessage).reverse() }
}

/** Record an uploaded file against a message. RLS enforces sender + participant. */
export async function attachToMessage(input: {
  messageId: string
  conversationId: string
  storagePath: string
  fileName: string
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
}): Promise<{ attachment?: ChatAttachment; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { data, error } = await supabase
    .from('chat_attachments')
    .insert({
      message_id: input.messageId,
      conversation_id: input.conversationId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      uploaded_by: user.id,
    })
    .select(ATTACH_COLS)
    .single()
  if (error) return { error: error.message }
  return { attachment: data as ChatAttachment }
}

/** Mint a 1-hour signed URL for an attachment. RLS gates both the row and the object. */
export async function getAttachmentUrl(attachmentId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: att } = await supabase.from('chat_attachments').select('storage_path').eq('id', attachmentId).maybeSingle()
  if (!att) return { error: 'Attachment not found.' }
  const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(att.storage_path as string, 3600)
  if (error || !data) return { error: error?.message ?? 'Could not create link.' }
  return { url: data.signedUrl }
}

export type SearchGroup = {
  conversationId: string
  kind: 'dm' | 'channel'
  title: string
  messages: Array<{ id: string; body: string; senderName: string; createdAt: string }>
}

/** Full-text search across the caller's conversations (RLS-scoped), grouped by conversation. */
export async function searchMessages(q: string): Promise<{ groups: SearchGroup[]; error?: string }> {
  const query = (q ?? '').trim()
  if (!query || query.length > 100) return { groups: [] }

  const supabase = await createClient()
  const { data: hits, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .textSearch('body_tsv', query, { type: 'websearch', config: 'english' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return { groups: [], error: error.message }
  if (!hits || hits.length === 0) return { groups: [] }

  const convIds = [...new Set(hits.map((h) => h.conversation_id as string))]
  const [{ data: convs }, { data: parts }, { data: directory }] = await Promise.all([
    supabase.from('chat_conversations').select('id, kind, name').in('id', convIds),
    supabase.from('chat_participants').select('conversation_id, user_id').in('conversation_id', convIds),
    supabase.rpc('dm_directory'),
  ])
  const names = new Map<string, string>(((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => [d.id, d.display_name]))
  const convMeta = new Map((convs ?? []).map((c) => [c.id as string, c]))
  const { data: { user } } = await supabase.auth.getUser()
  const dmOther = new Map<string, string>()
  for (const p of parts ?? []) {
    const c = convMeta.get(p.conversation_id as string)
    if (c?.kind === 'dm' && p.user_id !== user?.id) dmOther.set(p.conversation_id as string, p.user_id as string)
  }

  const groups = new Map<string, SearchGroup>()
  for (const h of hits) {
    const cid = h.conversation_id as string
    const c = convMeta.get(cid)
    if (!c) continue
    if (!groups.has(cid)) {
      const title = c.kind === 'channel' ? (c.name ?? 'Channel') : `DM with ${names.get(dmOther.get(cid) ?? '') ?? 'User'}`
      groups.set(cid, { conversationId: cid, kind: c.kind as 'dm' | 'channel', title, messages: [] })
    }
    groups.get(cid)!.messages.push({
      id: h.id as string,
      body: h.body as string,
      senderName: names.get(h.sender_id as string) ?? 'User',
      createdAt: h.created_at as string,
    })
  }
  return { groups: [...groups.values()] }
}
