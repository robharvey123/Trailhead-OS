import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'
import ConversationList, { type ConversationRow } from '@/components/messaging/ConversationList'

export const dynamic = 'force-dynamic'

type Conv = { id: string; user_a_id: string; user_b_id: string; last_message_at: string | null }

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: convsRaw }, { data: directory }] = await Promise.all([
    supabase.from('dm_conversations').select('id, user_a_id, user_b_id, last_message_at').order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase.rpc('dm_directory'),
  ])

  const convs = (convsRaw ?? []) as Conv[]
  const names = new Map<string, string>(((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => [d.id, d.display_name]))

  // One pass over this user's messages (RLS-scoped) for last-body + unread.
  const ids = convs.map((c) => c.id)
  let msgs: Array<{ conversation_id: string; body: string; sender_id: string | null; created_at: string }> = []
  let reads = new Map<string, string>()
  if (ids.length) {
    const [{ data: m }, { data: r }] = await Promise.all([
      supabase.from('dm_messages').select('conversation_id, body, sender_id, created_at').in('conversation_id', ids).order('created_at', { ascending: false }),
      supabase.from('dm_reads').select('conversation_id, last_read_at').eq('user_id', user.id),
    ])
    msgs = (m ?? []) as typeof msgs
    reads = new Map(((r ?? []) as Array<{ conversation_id: string; last_read_at: string }>).map((x) => [x.conversation_id, x.last_read_at]))
  }

  const lastByConv = new Map<string, { body: string; created_at: string }>()
  const unreadByConv = new Map<string, number>()
  for (const m of msgs) {
    if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at })
    if (m.sender_id !== user.id) {
      const last = reads.get(m.conversation_id)
      if (!last || new Date(last) < new Date(m.created_at)) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1)
      }
    }
  }

  const conversations: ConversationRow[] = convs.map((c) => {
    const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id
    const last = lastByConv.get(c.id)
    return {
      id: c.id,
      otherName: names.get(otherId) ?? 'User',
      lastBody: last?.body ?? null,
      lastAt: last?.created_at ?? c.last_message_at,
      unread: unreadByConv.get(c.id) ?? 0,
    }
  })

  const users = ((directory ?? []) as Array<{ id: string; display_name: string }>)
    .filter((d) => d.id !== user.id)
    .map((d) => ({ id: d.id, name: d.display_name }))

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden" style={{ height: 'calc(100vh - 140px)', maxWidth: 560 }}>
        <ConversationList conversations={conversations} users={users} />
      </div>
    </div>
  )
}
