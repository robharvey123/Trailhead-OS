'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  sendMessage,
  markConversationRead,
  loadOlderMessages,
  editMessage,
  deleteMessage,
  type DmMessage,
} from '@/app/(os)/messages/actions'
import MessageBubble from '@/components/messaging/MessageBubble'
import MessageComposer from '@/components/messaging/MessageComposer'
import TypingIndicator from '@/components/messaging/TypingIndicator'
import ReadIndicator from '@/components/messaging/ReadIndicator'
import ConfirmDialog from '@/components/os/ConfirmDialog'

type Msg = DmMessage & { pending?: boolean }
const EDIT_WINDOW_MS = 5 * 60 * 1000

export default function MessageClient({
  conversationId,
  meId,
  otherId,
  otherName,
  initialMessages,
  initialOtherReadAt,
}: {
  conversationId: string
  meId: string
  otherId: string
  otherName: string
  initialMessages: DmMessage[]
  initialOtherReadAt: string | null
}) {
  const [supabase] = useState(() => createClient())
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [otherReadAt, setOtherReadAt] = useState<string | null>(initialOtherReadAt)
  const [otherTyping, setOtherTyping] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // `now` drives the edit-window check; refreshed periodically so the ⋯ menu
  // disappears once a message ages out (kept out of render — Date.now() is impure).
  const [now, setNow] = useState(0)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSent = useRef(0)

  const markRead = useCallback(() => {
    void markConversationRead(conversationId)
  }, [conversationId])

  // postgres_changes: message INSERT + UPDATE (edit/delete) + dm_reads (receipts).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })()

    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as DmMessage
          setMessages((cur) =>
            cur.some((m) => m.id === incoming.id)
              ? cur.map((m) => (m.id === incoming.id ? { ...incoming } : m))
              : [...cur, incoming]
          )
          if (incoming.sender_id !== meId && typeof document !== 'undefined' && document.hasFocus()) markRead()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as DmMessage
          setMessages((cur) => cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dm_reads', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id?: string; last_read_at?: string }
          if (row?.user_id === otherId && row.last_read_at) setOtherReadAt(row.last_read_at)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [conversationId, supabase, meId, otherId, markRead])

  // Typing: a SEPARATE broadcast channel (never multiplex with postgres_changes).
  useEffect(() => {
    const channel = supabase.channel(`dm-typing:${conversationId}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { userId?: string })?.userId === meId) return
        setOtherTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setOtherTyping(false), 3000)
      })
      .subscribe()
    typingChannelRef.current = channel
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
      void supabase.removeChannel(channel)
      typingChannelRef.current = null
    }
  }, [conversationId, supabase, meId])

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < 2000) return // throttle: at most once / 2s
    lastTypingSent.current = now
    typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: meId } })
  }, [meId])

  useEffect(() => {
    markRead()
    const onFocus = () => markRead()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [markRead])

  // Tick `now` so the edit window expires live (every 20s is enough for a 5-min
  // window). Deferred via setTimeout so the first set isn't synchronous-in-effect.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t0 = setTimeout(tick, 0)
    const t = setInterval(tick, 20000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [])

  const lastId = messages[messages.length - 1]?.id
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lastId, otherTyping])

  async function handleSend(body: string) {
    setError('')
    const id = crypto.randomUUID()
    const optimistic: Msg = { id, sender_id: meId, body, created_at: new Date().toISOString(), pending: true }
    setMessages((cur) => [...cur, optimistic])
    const res = await sendMessage(conversationId, body, id)
    if (res.error) {
      setMessages((cur) => cur.filter((m) => m.id !== id))
      setError(res.error)
    } else {
      setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, pending: false, created_at: res.created_at ?? m.created_at } : m)))
    }
  }

  async function handleEdit(id: string, newBody: string) {
    setError('')
    const prev = messages.find((m) => m.id === id)
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, body: newBody, edited_at: new Date().toISOString() } : m)))
    const res = await editMessage(id, newBody)
    if (res.error) {
      setError(res.error)
      if (prev) setMessages((cur) => cur.map((m) => (m.id === id ? prev : m)))
    }
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

  // Read receipt only under the most-recent SENT message.
  let lastSentId: string | null = null
  for (const m of messages) if (m.sender_id === meId) lastSentId = m.id
  const lastSent = lastSentId ? messages.find((m) => m.id === lastSentId) : null
  const seenAt = lastSent && otherReadAt && new Date(otherReadAt).getTime() >= new Date(lastSent.created_at).getTime() ? otherReadAt : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gap: 8, alignContent: 'start' }}>
        {hasMore ? (
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
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
                <MessageBubble
                  id={m.id}
                  body={m.body}
                  mine={mine}
                  at={m.created_at}
                  pending={m.pending}
                  edited={!!m.edited_at}
                  deleted={!!m.deleted_at}
                  editable={editable}
                  onEdit={handleEdit}
                  onRequestDelete={(id) => setDeleteTargetId(id)}
                />
                {m.id === lastSentId && !m.deleted_at ? <ReadIndicator seenAt={seenAt} /> : null}
              </div>
            )
          })
        )}
        {otherTyping ? <TypingIndicator name={otherName} /> : null}
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
