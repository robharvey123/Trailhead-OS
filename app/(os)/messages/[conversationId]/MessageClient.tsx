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
  attachToMessage,
  type ChatMessage,
  type ChatAttachment,
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

/** Single helper for the storage path — path discipline is the whole RLS model. */
function attachmentPath(conversationId: string, fileName: string): string {
  return `${conversationId}/${crypto.randomUUID()}-${fileName.replace(/[^\w.\-]+/g, '_')}`
}

function imageDims(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(null)
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export default function MessageClient({
  conversationId,
  meId,
  kind,
  initialParticipants,
  initialMessages,
  highlightMessageId,
}: {
  conversationId: string
  meId: string
  kind: 'dm' | 'channel'
  initialParticipants: Participant[]
  initialMessages: ChatMessage[]
  highlightMessageId?: string
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
  const [flashId, setFlashId] = useState<string | null>(highlightMessageId ?? null)
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_attachments', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const att = payload.new as ChatAttachment
        setMessages((cur) => cur.map((m) => (m.id === att.message_id ? { ...m, attachments: [...(m.attachments ?? []).filter((a) => a.id !== att.id), att] } : m)))
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
  useEffect(() => {
    // When arriving via a search result, scroll to + flash that message instead
    // of jumping to the bottom.
    if (highlightMessageId) return
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [lastId, typingName, highlightMessageId])

  useEffect(() => {
    if (!highlightMessageId) return
    const scroll = setTimeout(() => {
      document.querySelector(`[data-mid="${highlightMessageId}"]`)?.scrollIntoView({ block: 'center' })
    }, 60)
    const unflash = setTimeout(() => setFlashId(null), 2200)
    return () => { clearTimeout(scroll); clearTimeout(unflash) }
  }, [highlightMessageId])

  async function handleSend(body: string, files: File[] = []) {
    setError('')
    const id = crypto.randomUUID()
    const optimistic: Msg = { id, sender_id: meId, body, created_at: new Date().toISOString(), pending: true, attachments: [] }
    setMessages((cur) => [...cur, optimistic])
    const res = await sendMessage(conversationId, body, id)
    if (res.error) { setMessages((cur) => cur.filter((m) => m.id !== id)); setError(res.error); return }
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, pending: false, created_at: res.created_at ?? m.created_at } : m)))

    // Upload files AFTER the message exists, then record each attachment.
    for (const file of files) {
      const path = attachmentPath(conversationId, file.name)
      const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) { setError(`Upload failed for ${file.name}. Reattach to retry.`); continue }
      const dims = await imageDims(file).catch(() => null)
      const att = await attachToMessage({
        messageId: id,
        conversationId,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        width: dims?.w ?? null,
        height: dims?.h ?? null,
      })
      if (att.error) { setError(`Couldn't attach ${file.name}.`); continue }
      if (att.attachment) {
        const created = att.attachment
        setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, attachments: [...(m.attachments ?? []).filter((a) => a.id !== created.id), created] } : m)))
      }
    }
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
              <div key={m.id} data-mid={m.id} style={{ borderRadius: 12, transition: 'background 0.4s', background: m.id === flashId ? 'var(--accent-dim)' : 'transparent', padding: m.id === flashId ? 4 : 0 }}>
                <MessageBubble id={m.id} body={m.body} mine={mine} at={m.created_at} pending={m.pending} edited={!!m.edited_at} deleted={!!m.deleted_at} editable={editable} attachments={m.attachments} onEdit={handleEdit} onRequestDelete={(id) => setDeleteTargetId(id)} />
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
