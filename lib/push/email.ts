import { supabaseService } from '@/lib/supabase/service'
import { pushToUser } from './server'

export interface NewMailPushItem {
  from_name: string | null
  from_address: string | null
  subject: string | null
}

/**
 * Fire a Web Push to every admin/owner when the gmail-sync cron ingests new
 * inbound mail. The inbox is admin-only (email_logs RLS = is_admin()), so the
 * shared mailbox notifies the admins. Service-role reads; call fire-and-forget.
 * A shared `tag` collapses repeated alerts so a busy mailbox doesn't stack.
 */
export async function dispatchNewMailPush(items: NewMailPushItem[]): Promise<void> {
  if (items.length === 0) return

  const { data: admins } = await supabaseService
    .from('profiles')
    .select('id')
    .in('role', ['owner', 'admin'])
  const userIds = (admins ?? []).map((a) => a.id as string)
  if (userIds.length === 0) return

  const first = items[0]
  const sender = (first.from_name || first.from_address || 'Someone').trim()
  const subject = (first.subject || '(no subject)').trim()
  const payload =
    items.length === 1
      ? { title: `New email — ${sender}`, body: subject }
      : { title: `${items.length} new emails`, body: `Latest — ${sender}: ${subject}` }

  await Promise.all(
    userIds.map((uid) =>
      pushToUser(uid, { ...payload, url: '/inbox', tag: 'inbox:new', category: 'push_new_email' })
    )
  )
}
