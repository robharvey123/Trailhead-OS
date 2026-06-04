import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'
import ConversationList, { type ConversationRow } from '@/components/messaging/ConversationList'

export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: myParts }, { data: directory }] = await Promise.all([
    supabase
      .from('chat_participants')
      .select('conversation_id, last_read_at, chat_conversations!inner(id, kind, name, last_message_at)')
      .eq('user_id', user.id),
    supabase.rpc('dm_directory'),
  ])

  const names = new Map<string, string>(((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => [d.id, d.display_name]))
  type ConvMeta = { id: string; kind: 'dm' | 'channel'; name: string | null; last_message_at: string | null }
  const convs = (myParts ?? []).map((p) => ({
    conv: p.chat_conversations as unknown as ConvMeta,
    lastReadAt: p.last_read_at as string,
  }))
  const ids = convs.map((c) => c.conv.id)
  const readAt = new Map<string, string>(convs.map((c) => [c.conv.id, c.lastReadAt]))

  // All participants (member counts + DM "other"), last message + unread.
  const allMembers = new Map<string, string[]>()
  const lastByConv = new Map<string, { body: string; created_at: string; deleted: boolean }>()
  const unreadByConv = new Map<string, number>()
  if (ids.length) {
    const [{ data: parts }, { data: msgs }] = await Promise.all([
      supabase.from('chat_participants').select('conversation_id, user_id').in('conversation_id', ids),
      supabase.from('chat_messages').select('conversation_id, body, sender_id, created_at, deleted_at').in('conversation_id', ids).order('created_at', { ascending: false }),
    ])
    for (const p of parts ?? []) {
      const arr = allMembers.get(p.conversation_id as string) ?? []
      arr.push(p.user_id as string)
      allMembers.set(p.conversation_id as string, arr)
    }
    for (const m of msgs ?? []) {
      if (!lastByConv.has(m.conversation_id as string)) {
        lastByConv.set(m.conversation_id as string, { body: m.body as string, created_at: m.created_at as string, deleted: !!m.deleted_at })
      }
      if (m.sender_id !== user.id && !m.deleted_at) {
        const last = readAt.get(m.conversation_id as string)
        if (!last || new Date(last) < new Date(m.created_at as string)) {
          unreadByConv.set(m.conversation_id as string, (unreadByConv.get(m.conversation_id as string) ?? 0) + 1)
        }
      }
    }
  }

  const conversations: ConversationRow[] = convs
    .map(({ conv }) => {
      const members = allMembers.get(conv.id) ?? []
      const last = lastByConv.get(conv.id)
      const otherId = conv.kind === 'dm' ? members.find((m) => m !== user.id) : undefined
      return {
        id: conv.id,
        kind: conv.kind,
        title: conv.kind === 'channel' ? (conv.name ?? 'Channel') : (otherId ? names.get(otherId) ?? 'User' : 'User'),
        memberCount: members.length,
        lastBody: last ? (last.deleted ? 'Message deleted' : last.body) : null,
        lastAt: last?.created_at ?? conv.last_message_at,
        unread: unreadByConv.get(conv.id) ?? 0,
      }
    })
    .sort((a, b) => (b.lastAt ? new Date(b.lastAt).getTime() : 0) - (a.lastAt ? new Date(a.lastAt).getTime() : 0))

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
