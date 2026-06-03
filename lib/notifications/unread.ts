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
