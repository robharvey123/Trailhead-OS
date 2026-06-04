'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markConversationRead, loadOlderMessages, type DmMessage } from '@/app/(os)/messages/actions'
import MessageBubble from '@/components/messaging/MessageBubble'
import MessageComposer from '@/components/messaging/MessageComposer'

type Msg = DmMessage & { pending?: boolean }

export default function MessageClient({
  conversationId,
  meId,
  initialMessages,
}: {
  conversationId: string
  meId: string
  initialMessages: DmMessage[]
}) {
  const [supabase] = useState(() => createClient())
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const markRead = useCallback(() => {
    void markConversationRead(conversationId)
  }, [conversationId])

  // Realtime: subscribe to inserts for THIS conversation only.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      // Pass the user JWT so Realtime applies RLS (delivers only to participants).
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
              ? cur.map((m) => (m.id === incoming.id ? { ...incoming } : m)) // dedupe own optimistic row
              : [...cur, incoming]
          )
          if (incoming.sender_id !== meId && typeof document !== 'undefined' && document.hasFocus()) {
            markRead()
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [conversationId, supabase, meId, markRead])

  // Mark read on mount (after first render) + whenever the window regains focus.
  useEffect(() => {
    markRead()
    const onFocus = () => markRead()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [markRead])

  // Auto-scroll on a NEW trailing message (keyed on last id, so prepending older
  // pages doesn't yank the view to the bottom).
  const lastId = messages[messages.length - 1]?.id
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lastId])

  async function handleSend(body: string) {
    setError('')
    const id = crypto.randomUUID()
    const optimistic: Msg = { id, sender_id: meId, body, created_at: new Date().toISOString(), pending: true }
    setMessages((cur) => [...cur, optimistic])
    const res = await sendMessage(conversationId, body, id)
    if (res.error) {
      setMessages((cur) => cur.filter((m) => m.id !== id)) // rollback
      setError(res.error)
    } else {
      setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, pending: false, created_at: res.created_at ?? m.created_at } : m)))
    }
  }

  async function loadMore() {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    const res = await loadOlderMessages(conversationId, messages[0].created_at)
    if (res.messages.length < 50) setHasMore(false)
    setMessages((cur) => [...res.messages.filter((om) => !cur.some((c) => c.id === om.id)), ...cur])
    setLoadingMore(false)
  }

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
          messages.map((m) => (
            <MessageBubble key={m.id} body={m.body} mine={m.sender_id === meId} at={m.created_at} pending={m.pending} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '0 16px' }}>{error}</p> : null}
      <MessageComposer onSend={handleSend} />
    </div>
  )
}
