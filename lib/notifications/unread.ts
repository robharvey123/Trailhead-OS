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

  const { data: convs } = await supabase.from('dm_conversations').select('id')
  const ids = (convs ?? []).map((c) => c.id as string)
  if (ids.length === 0) return 0

  const [{ data: msgs }, { data: reads }] = await Promise.all([
    supabase.from('dm_messages').select('conversation_id, created_at').neq('sender_id', userId).in('conversation_id', ids),
    supabase.from('dm_reads').select('conversation_id, last_read_at').eq('user_id', userId),
  ])

  const readAt = new Map<string, string>((reads ?? []).map((r) => [r.conversation_id as string, r.last_read_at as string]))
  let count = 0
  for (const m of msgs ?? []) {
    const last = readAt.get(m.conversation_id as string)
    if (!last || new Date(last) < new Date(m.created_at as string)) count++
  }
  return count
}
