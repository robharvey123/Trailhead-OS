import { supabaseService } from '@/lib/supabase/service'
import { pushToPerson, pushToUser } from './server'

function preview(body: string): string {
  const text = (body || '').trim()
  if (!text) return 'Sent an attachment'
  return text.length > 140 ? `${text.slice(0, 139)}…` : text
}

/**
 * Fire push notifications for a just-sent chat message:
 *  - DM → the other participant (category: direct_message)
 *  - channel → only the people explicitly @mentioned, minus the sender (mention)
 *
 * Service-role reads (it touches other users' rows). Call fire-and-forget after
 * the message + mentions are written.
 */
export async function dispatchMessagePush(input: {
  conversationId: string
  senderId: string
  body: string
  mentionPersonIds: string[]
}): Promise<void> {
  const { conversationId, senderId, body, mentionPersonIds } = input

  const [{ data: conv }, { data: senderProfile }] = await Promise.all([
    supabaseService.from('chat_conversations').select('kind, name').eq('id', conversationId).maybeSingle(),
    supabaseService.from('profiles').select('display_name').eq('id', senderId).maybeSingle(),
  ])
  if (!conv) return

  const senderName = (senderProfile?.display_name as string | null) || 'Someone'
  const url = `/messages/${conversationId}`
  const text = preview(body)

  if (conv.kind === 'dm') {
    const { data: parts } = await supabaseService
      .from('chat_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
    const other = (parts ?? []).map((p) => p.user_id as string).find((uid) => uid !== senderId)
    if (other) {
      await pushToUser(other, {
        title: senderName,
        body: text,
        url,
        tag: `dm:${conversationId}`,
        category: 'push_direct_message',
      })
    }
    return
  }

  if (mentionPersonIds.length === 0) return
  const where = conv.name ? `#${conv.name}` : 'a channel'
  await Promise.all(
    mentionPersonIds.map((personId) =>
      pushToPerson(
        personId,
        {
          title: `${senderName} mentioned you in ${where}`,
          body: text,
          url,
          tag: `mention:${conversationId}`,
          category: 'push_mention',
        },
        senderId
      )
    )
  )
}
