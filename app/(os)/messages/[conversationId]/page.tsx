import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { mockupFontVars } from '@/lib/fonts'
import MessageClient from './MessageClient'
import type { DmMessage } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS returns the row only if the caller is a participant.
  const { data: conv } = await supabase
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id')
    .eq('id', conversationId)
    .maybeSingle()
  if (!conv) notFound()

  const otherId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id
  const { data: directory } = await supabase.rpc('dm_directory')
  const otherName = ((directory ?? []) as Array<{ id: string; display_name: string }>).find((d) => d.id === otherId)?.display_name ?? 'User'

  // Last 50 messages, ascending for display.
  const { data: recent } = await supabase
    .from('dm_messages')
    .select('id, sender_id, body, created_at, edited_at, deleted_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50)
  const initialMessages = ((recent ?? []) as DmMessage[]).reverse()

  // Other participant's read cursor for the "Seen" receipt (readable via the
  // participant SELECT policy added in brief 13).
  const { data: otherRead } = await supabase
    .from('dm_reads')
    .select('last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', otherId)
    .maybeSingle()

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden" style={{ height: 'calc(100vh - 140px)', maxWidth: 720, display: 'flex', flexDirection: 'column' }}>
        <div className="topbar" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/messages" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Messages</Link>
          <span className="topbar-title">{otherName}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MessageClient
            conversationId={conversationId}
            meId={user.id}
            otherId={otherId}
            otherName={otherName}
            initialMessages={initialMessages}
            initialOtherReadAt={(otherRead?.last_read_at as string | undefined) ?? null}
          />
        </div>
      </div>
    </div>
  )
}
