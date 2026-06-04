'use server'

import { createClient } from '@/lib/supabase/server'

async function currentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Find or create the 1:1 conversation between the caller and otherUserId.
 * Pair is stored in canonical order (smaller uuid = user_a) so A↔B is one row.
 */
export async function startConversation(otherUserId: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!otherUserId || otherUserId === user.id) return { error: 'Pick a different person to message.' }

  const [a, b] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id]

  const { data: existing } = await supabase
    .from('dm_conversations')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle()
  if (existing) return { id: existing.id as string }

  const { data: created, error } = await supabase
    .from('dm_conversations')
    .insert({ user_a_id: a, user_b_id: b })
    .select('id')
    .single()
  if (error) {
    // Lost an insert race: the row now exists — re-select it.
    const { data: row } = await supabase
      .from('dm_conversations')
      .select('id')
      .eq('user_a_id', a)
      .eq('user_b_id', b)
      .maybeSingle()
    if (row) return { id: row.id as string }
    return { error: error.message }
  }
  return { id: created.id as string }
}

/**
 * Insert a message. The client passes its optimistic row id so the realtime
 * INSERT event can be de-duplicated against the optimistic bubble.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  messageId?: string
): Promise<{ id?: string; created_at?: string; error?: string }> {
  const trimmed = (body ?? '').trim()
  if (!trimmed) return { error: 'Message is empty.' }
  if (trimmed.length > 4000) return { error: 'Message is too long (max 4000 characters).' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const payload: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: user.id,
    body: trimmed,
  }
  if (messageId) payload.id = messageId

  const { data, error } = await supabase.from('dm_messages').insert(payload).select('id, created_at').single()
  if (error) return { error: error.message }
  return { id: data.id as string, created_at: data.created_at as string }
}

export type DmMessage = { id: string; sender_id: string | null; body: string; created_at: string }

/** Older page of messages (50) before a cursor, ascending. RLS scopes to participants. */
export async function loadOlderMessages(conversationId: string, beforeIso: string): Promise<{ messages: DmMessage[]; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .lt('created_at', beforeIso)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return { messages: [], error: error.message }
  return { messages: ((data ?? []) as DmMessage[]).reverse() }
}

/** Idempotent read-cursor bump. Safe to call on every conversation open. */
export async function markConversationRead(conversationId: string): Promise<{ error?: string }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Not signed in' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('dm_reads')
    .upsert(
      { user_id: userId, conversation_id: conversationId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,conversation_id' }
    )
  if (error) return { error: error.message }
  return {}
}
