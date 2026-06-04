'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  sendMessage,
  markConversationRead,
  loadOlderMessages,
  editMessage,
  deleteMessage,
  type ChatMessage,
} from '@/app/(os)/messages/actions'
import MessageBubble from '@/components/messaging/MessageBubble'
import MessageComposer from '@/components/messaging/MessageComposer'
import TypingIndicator from '@/components/messaging/TypingIndicator'
import ReadIndicator from '@/components/messaging/ReadIndicator'
import ConfirmDialog from '@/components/os/ConfirmDialog'

type Msg = ChatMessage & { pending?: boolean }
type Participant = { userId: string; name: string; lastReadAt: string }
const EDIT_WINDOW_MS = 5 * 60 * 1000

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageClient({
  conversationId,
  meId,
  kind,
  initialParticipants,
  initialMessages,
}: {
  conversationId: string
  meId: string
  kind: 'dm' | 'channel'
  initialParticipants: Participant[]
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [typingName, setTypingName] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [now, setNow] = useState(0)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSent = useRef(0)

  const markRead = useCallback(() => { void markConversationRead(conversationId) }, [conversationId])

  // postgres_changes: messages INSERT/UPDATE + participants (membership + read cursors).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })()

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const incoming = payload.new as ChatMessage
        setMessages((cur) => (cur.some((m) => m.id === incoming.id) ? cur.map((m) => (m.id === incoming.id ? { ...incoming } : m)) : [...cur, incoming]))
        if (incoming.sender_id !== meId && typeof document !== 'undefined' && document.hasFocus()) markRead()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const updated = payload.new as ChatMessage
        setMessages((cur) => cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = (payload.new ?? payload.old) as { user_id?: string; last_read_at?: string }
        if (payload.eventType === 'UPDATE' && row?.user_id && row.user_id !== meId && row.last_read_at) {
          setParticipants((cur) => cur.map((p) => (p.userId === row.user_id ? { ...p, lastReadAt: row.last_read_at! } : p)))
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          router.refresh() // membership changed — re-fetch names/roles
        }
      })
      .subscribe()

    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [conversationId, supabase, meId, markRead, router])

  // Typing: separate broadcast channel.
  useEffect(() => {
    const channel = supabase.channel(`chat-typing:${conversationId}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as { userId?: string }
        if (!p?.userId || p.userId === meId) return
        const who = participants.find((x) => x.userId === p.userId)?.name ?? 'Someone'
        setTypingName(who)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setTypingName(null), 3000)
      })
      .subscribe()
    typingChannelRef.current = channel
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      void supabase.removeChannel(channel)
      typingChannelRef.current = null
    }
  }, [conversationId, supabase, meId, participants])

  const notifyTyping = useCallback(() => {
    const t = Date.now()
    if (t - lastTypingSent.current < 2000) return
    lastTypingSent.current = t
    typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: meId } })
  }, [meId])

  useEffect(() => {
    markRead()
    const onFocus = () => markRead()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [markRead])

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t0 = setTimeout(tick, 0)
    const t = setInterval(tick, 20000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [])

  const lastId = messages[messages.length - 1]?.id
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }) }, [lastId, typingName])

  async function handleSend(body: string) {
    setError('')
    const id = crypto.randomUUID()
    const optimistic: Msg = { id, sender_id: meId, body, created_at: new Date().toISOString(), pending: true }
    setMessages((cur) => [...cur, optimistic])
    const res = await sendMessage(conversationId, body, id)
    if (res.error) { setMessages((cur) => cur.filter((m) => m.id !== id)); setError(res.error) }
    else setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, pending: false, created_at: res.created_at ?? m.created_at } : m)))
  }

  async function handleEdit(id: string, newBody: string) {
    setError('')
    const prev = messages.find((m) => m.id === id)
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, body: newBody, edited_at: new Date().toISOString() } : m)))
    const res = await editMessage(id, newBody)
    if (res.error) { setError(res.error); if (prev) setMessages((cur) => cur.map((m) => (m.id === id ? prev : m))) }
  }

  async function confirmDelete() {
    if (!deleteTargetId) return
    setDeleting(true)
    const res = await deleteMessage(deleteTargetId)
    if (res.error) setError(res.error)
    else setMessages((cur) => cur.map((m) => (m.id === deleteTargetId ? { ...m, deleted_at: new Date().toISOString(), body: '' } : m)))
    setDeleting(false)
    setDeleteTargetId(null)
  }

  async function loadMore() {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    const res = await loadOlderMessages(conversationId, messages[0].created_at)
    if (res.messages.length < 50) setHasMore(false)
    setMessages((cur) => [...res.messages.filter((om) => !cur.some((c) => c.id === om.id)), ...cur])
    setLoadingMore(false)
  }

  // Read receipt under the latest SENT message only.
  let lastSentId: string | null = null
  for (const m of messages) if (m.sender_id === meId) lastSentId = m.id
  const lastSent = lastSentId ? messages.find((m) => m.id === lastSentId) : null
  let receiptLabel = ''
  if (lastSent) {
    const sentAt = new Date(lastSent.created_at).getTime()
    const seenBy = participants.filter((p) => new Date(p.lastReadAt).getTime() >= sentAt)
    if (kind === 'dm') {
      receiptLabel = seenBy.length ? `Seen at ${fmtTime(seenBy[0].lastReadAt)}` : 'Sent'
    } else {
      receiptLabel = seenBy.length === 0
        ? 'Sent'
        : seenBy.length === participants.length
          ? 'Seen by everyone'
          : `Seen by ${seenBy.length}`
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 8, alignContent: 'start' }}>
        {hasMore ? (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older messages'}</button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginTop: 24 }}>No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === meId
            const editable = mine && !m.deleted_at && !m.pending && now - new Date(m.created_at).getTime() < EDIT_WINDOW_MS
            return (
              <div key={m.id}>
                <MessageBubble id={m.id} body={m.body} mine={mine} at={m.created_at} pending={m.pending} edited={!!m.edited_at} deleted={!!m.deleted_at} editable={editable} onEdit={handleEdit} onRequestDelete={(id) => setDeleteTargetId(id)} />
                {m.id === lastSentId && !m.deleted_at ? <ReadIndicator label={receiptLabel} /> : null}
              </div>
            )
          })
        )}
        {typingName ? <TypingIndicator name={typingName} /> : null}
        <div ref={bottomRef} />
      </div>
      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '0 16px' }}>{error}</p> : null}
      <MessageComposer onSend={handleSend} onTyping={notifyTyping} />

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}
        title="Delete this message?"
        description="It will be replaced with a “Message deleted” placeholder. This can't be undone."
        confirmLabel="Delete message"
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        variant="destructive"
      />
    </div>
  )
}
