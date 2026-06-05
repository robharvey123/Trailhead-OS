import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'
import MessageClient from './MessageClient'
import ChannelManageButton from '@/components/messaging/ChannelManageButton'
import { listPeople } from '@/lib/db/people'
import { normalizeMessage } from '../normalize'
import type { ChatMessage } from '../actions'

export const dynamic = 'force-dynamic'

const MSG_SELECT = 'id, sender_id, body, created_at, edited_at, deleted_at, attachments:chat_attachments(id, message_id, storage_path, file_name, mime_type, byte_size, width, height), mentions:chat_message_mentions(mentioned_person_id, person:people(id, full_name))'

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>
  searchParams: Promise<{ msg?: string }>
}) {
  const { conversationId } = await params
  const { msg } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS returns the row only if the caller is a participant.
  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('id, kind, name')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) notFound()

  const [{ data: parts }, { data: directory }] = await Promise.all([
    supabase.from('chat_participants').select('user_id, role, joined_at, last_read_at').eq('conversation_id', conversationId),
    supabase.rpc('dm_directory'),
  ])
  const names = new Map<string, string>(((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => [d.id, d.display_name]))

  const me = (parts ?? []).find((p) => p.user_id === user.id)
  const amAdmin = me?.role === 'admin'
  const others = (parts ?? [])
    .filter((p) => p.user_id !== user.id)
    .map((p) => ({ userId: p.user_id as string, name: names.get(p.user_id as string) ?? 'User', lastReadAt: p.last_read_at as string }))

  const members = (parts ?? []).map((p) => ({
    userId: p.user_id as string,
    name: names.get(p.user_id as string) ?? 'User',
    role: p.role as string,
    joinedAt: p.joined_at as string,
  }))

  const title = conv.kind === 'channel' ? (conv.name ?? 'Channel') : (others[0]?.name ?? 'User')

  // Default: last 50. If arriving via a search result (?msg=), load a window
  // centred on that message so it's present to scroll to.
  let initialMessages: ChatMessage[] = []
  let target: { created_at: string } | null = null
  if (msg) {
    const { data: t } = await supabase.from('chat_messages').select('created_at').eq('id', msg).maybeSingle()
    target = t as { created_at: string } | null
  }
  if (target) {
    const [{ data: before }, { data: after }] = await Promise.all([
      supabase.from('chat_messages').select(MSG_SELECT).eq('conversation_id', conversationId).lte('created_at', target.created_at).order('created_at', { ascending: false }).limit(26),
      supabase.from('chat_messages').select(MSG_SELECT).eq('conversation_id', conversationId).gt('created_at', target.created_at).order('created_at', { ascending: true }).limit(25),
    ])
    initialMessages = [...((before ?? []) as unknown as ChatMessage[]).map(normalizeMessage).reverse(), ...((after ?? []) as unknown as ChatMessage[]).map(normalizeMessage)]
  } else {
    const { data: recent } = await supabase
      .from('chat_messages')
      .select(MSG_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50)
    initialMessages = ((recent ?? []) as unknown as ChatMessage[]).map(normalizeMessage).reverse()
  }

  const usersDirectory = ((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => ({ id: d.id, name: d.display_name }))

  // Active people for the @mention autocomplete (people RLS lets any authenticated user read).
  const people = (await listPeople({ activeOnly: true }, supabase).catch(() => []))
    .map((p) => ({ id: p.id, full_name: p.full_name }))

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden" style={{ height: 'calc(100vh - 140px)', maxWidth: 720, display: 'flex', flexDirection: 'column' }}>
        <div className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/messages" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Messages</Link>
          <span className="topbar-title" style={{ flex: 1 }}>{conv.kind === 'channel' ? `# ${title}` : title}</span>
          {conv.kind === 'channel' ? (
            <ChannelManageButton conversationId={conversationId} members={members} users={usersDirectory} isAdmin={amAdmin} meId={user.id} />
          ) : null}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MessageClient
            conversationId={conversationId}
            meId={user.id}
            kind={conv.kind as 'dm' | 'channel'}
            initialParticipants={others}
            initialMessages={initialMessages}
            people={people}
            highlightMessageId={target ? msg : undefined}
          />
        </div>
      </div>
    </div>
  )
}
