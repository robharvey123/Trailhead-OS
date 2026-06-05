import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Count of tasks assigned to this person that are "unread": no read-state row,
 * or the cursor predates the task's last update (assignment / comment / change
 * all bump updated_at). RLS lets a person read their own assigned tasks + own
 * read-state, so this is safe to call for the current user.
 */
export async function getUnreadTaskCount(personId: string, client?: SupabaseClient): Promise<number> {
  if (!personId) return 0
  const supabase = client ?? (await createClient())

  const [{ data: tasks }, { data: reads }] = await Promise.all([
    supabase.from('engagement_tasks').select('id, updated_at').eq('assignee_person_id', personId),
    supabase.from('engagement_task_read_state').select('task_id, last_read_at').eq('person_id', personId),
  ])

  const readAt = new Map<string, string>((reads ?? []).map((r) => [r.task_id as string, r.last_read_at as string]))
  let count = 0
  for (const t of tasks ?? []) {
    const last = readAt.get(t.id as string)
    if (!last || new Date(last) < new Date(t.updated_at as string)) count++
  }
  return count
}

/**
 * Count of unread mail threads still in the inbox (distinct gmail_thread_id with
 * an unread message carrying the INBOX label). email_logs is the shared, admin-
 * only mailbox, so RLS returns rows only for admins — non-admins get 0.
 */
export async function getUnreadMailCount(client?: SupabaseClient): Promise<number> {
  const supabase = client ?? (await createClient())
  const { data } = await supabase.from('email_logs').select('gmail_thread_id, labels').eq('is_unread', true)
  const threads = new Set<string>()
  for (const r of data ?? []) {
    const labels = (r.labels ?? []) as string[]
    if (r.gmail_thread_id && labels.includes('INBOX')) threads.add(r.gmail_thread_id as string)
  }
  return threads.size
}

/**
 * Count of direct messages from OTHER users, across the caller's conversations,
 * newer than the caller's per-conversation read cursor. Keyed on the auth user
 * id (messaging is auth-user scoped). RLS limits every table to the caller's own
 * conversations, so this is safe for the current user only.
 */
export async function getUnreadMessagesCount(userId: string, client?: SupabaseClient): Promise<number> {
  if (!userId) return 0
  const supabase = client ?? (await createClient())

  // The caller's conversations + their per-conversation read cursor.
  const { data: parts } = await supabase.from('chat_participants').select('conversation_id, last_read_at').eq('user_id', userId)
  const readAt = new Map<string, string>((parts ?? []).map((p) => [p.conversation_id as string, p.last_read_at as string]))
  const ids = [...readAt.keys()]
  if (ids.length === 0) return 0

  const { data: msgs } = await supabase
    .from('chat_messages')
    .select('conversation_id, created_at')
    .neq('sender_id', userId)
    .is('deleted_at', null)
    .in('conversation_id', ids)

  let count = 0
  for (const m of msgs ?? []) {
    const last = readAt.get(m.conversation_id as string)
    if (!last || new Date(last) < new Date(m.created_at as string)) count++
  }
  return count
}

/**
 * Count of chat mentions of the current user that are still unread: the mention's
 * message is newer than the caller's read cursor for that conversation and not
 * deleted. Additive to {@link getUnreadMessagesCount} — a mention is also an
 * unread message; the two are computed independently from the same state.
 *
 * Keyed on the auth user id; resolves the caller's person id via
 * people.auth_user_id. Mentions RLS (is_chat_participant) already limits rows to
 * the caller's conversations, so a mention in a conversation you're not in never
 * counts. Self-mentions (you @yourself) don't count.
 */
export async function getUnreadMentionsCount(userId: string, client?: SupabaseClient): Promise<number> {
  if (!userId) return 0
  const supabase = client ?? (await createClient())

  const { data: me } = await supabase.from('people').select('id').eq('auth_user_id', userId).maybeSingle()
  const personId = me?.id as string | undefined
  if (!personId) return 0

  const { data: parts } = await supabase.from('chat_participants').select('conversation_id, last_read_at').eq('user_id', userId)
  const readAt = new Map<string, string>((parts ?? []).map((p) => [p.conversation_id as string, p.last_read_at as string]))
  if (readAt.size === 0) return 0

  const { data: mentions } = await supabase
    .from('chat_message_mentions')
    .select('conversation_id, message:chat_messages(created_at, deleted_at, sender_id)')
    .eq('mentioned_person_id', personId)

  let count = 0
  for (const row of mentions ?? []) {
    const msg = (Array.isArray(row.message) ? row.message[0] : row.message) as
      | { created_at: string; deleted_at: string | null; sender_id: string | null }
      | undefined
    if (!msg || msg.deleted_at || msg.sender_id === userId) continue
    const last = readAt.get(row.conversation_id as string)
    if (!last || new Date(last) < new Date(msg.created_at)) count++
  }
  return count
}
