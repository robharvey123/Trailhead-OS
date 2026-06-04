import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'
import MessageClient from './MessageClient'
import ChannelManageButton from '@/components/messaging/ChannelManageButton'
import type { ChatMessage } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params
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

  const { data: recent } = await supabase
    .from('chat_messages')
    .select('id, sender_id, body, created_at, edited_at, deleted_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50)
  const initialMessages = ((recent ?? []) as ChatMessage[]).reverse()

  const usersDirectory = ((directory ?? []) as Array<{ id: string; display_name: string }>).map((d) => ({ id: d.id, name: d.display_name }))

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
          />
        </div>
      </div>
    </div>
  )
}
