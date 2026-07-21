'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import { apiFetch } from '@/lib/api-fetch'
import { createClient } from '@/lib/supabase/client'
import type { EmailLog, EmailThread } from '@/lib/types'

type LiveStatus = 'connecting' | 'live' | 'offline'
import ComposeModal from './ComposeModal'
import SafeEmailHtml from '../SafeEmailHtml'

type Named = { id: string; name: string }
type ContactOpt = { id: string; name: string; email: string | null; account_id: string | null }
type Folder = 'inbox' | 'unread' | 'all' | 'starred' | 'unmatched' | 'sent' | 'archived'

const FOLDERS: Array<{ key: Folder; label: string; icon: string }> = [
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'unread', label: 'Unread', icon: '✉' },
  { key: 'all', label: 'All', icon: '⊞' },
  { key: 'starred', label: 'Starred', icon: '★' },
  { key: 'unmatched', label: 'Unmatched', icon: '⚠' },
  { key: 'sent', label: 'Sent', icon: '↗' },
  { key: 'archived', label: 'Archived', icon: '🗄' },
]

function timeLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function InboxClient({
  initialThreads,
  accounts,
  contacts,
  connected,
  selfEmail,
  signature = '',
}: {
  initialThreads: EmailThread[]
  accounts: Named[]
  contacts: ContactOpt[]
  connected: boolean
  selfEmail: string
  signature?: string
}) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [threads, setThreads] = useState(initialThreads)
  const [folder, setFolder] = useState<Folder>('inbox')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<EmailLog[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('connecting')
  const [loadingMessages, setLoadingMessages] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror of `threads`/`activeId` for reading current values inside async
  // callbacks without stale closures.
  const threadsRef = useRef(threads)
  useEffect(() => { threadsRef.current = threads }, [threads])
  const activeIdRef = useRef<string | null>(null)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // Optimistic field overrides not yet confirmed by the server, keyed by thread.
  // Re-applied on top of any refetch so realtime/sync refreshes never stomp an
  // in-flight optimistic change.
  const pendingRef = useRef<Map<string, Partial<EmailThread>>>(new Map())
  // Fetched thread messages, so reopening a thread is instant.
  const messageCacheRef = useRef<Map<string, EmailLog[]>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  function mergePending(id: string, patch: Partial<EmailThread>) {
    pendingRef.current.set(id, { ...(pendingRef.current.get(id) ?? {}), ...patch })
  }
  function clearPending(id: string, patch: Partial<EmailThread>) {
    const cur = pendingRef.current.get(id)
    if (!cur) return
    const next: Record<string, unknown> = { ...cur }
    for (const k of Object.keys(patch)) delete next[k]
    if (Object.keys(next).length === 0) pendingRef.current.delete(id)
    else pendingRef.current.set(id, next as Partial<EmailThread>)
  }
  function applyOverride(id: string, patch: Partial<EmailThread>) {
    setThreads((prev) => prev.map((x) => (x.gmail_thread_id === id ? { ...x, ...patch } : x)))
  }

  /**
   * Apply an optimistic patch to a thread now, fire the PATCH in the background,
   * and on failure restore the exact prior thread (snapshot, not a refetch — a
   * refetch mid-typing would clobber other in-flight optimistic changes).
   */
  async function runOptimistic(id: string, patch: Partial<EmailThread>, action: string, extra?: Record<string, unknown>) {
    const snapshot = threadsRef.current.find((t) => t.gmail_thread_id === id)
    if (!snapshot) return
    mergePending(id, patch)
    applyOverride(id, patch)
    try {
      await apiFetch(`/api/inbox/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
      })
      clearPending(id, patch)
    } catch (err) {
      clearPending(id, patch)
      setThreads((prev) => prev.map((x) => (x.gmail_thread_id === id ? snapshot : x)))
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const counts = useMemo(() => ({
    inbox: threads.filter((t) => t.in_inbox).length,
    unread: threads.filter((t) => t.is_unread && t.in_inbox).length,
    all: threads.length,
    starred: threads.filter((t) => t.is_starred).length,
    unmatched: threads.filter((t) => !t.account_id).length,
    sent: threads.filter((t) => t.has_outbound).length,
    archived: threads.filter((t) => !t.in_inbox).length,
  }), [threads])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return threads.filter((t) => {
      if (folder === 'inbox' && !t.in_inbox) return false
      if (folder === 'archived' && t.in_inbox) return false
      if (folder === 'unread' && !(t.is_unread && t.in_inbox)) return false
      if (folder === 'starred' && !t.is_starred) return false
      if (folder === 'unmatched' && t.account_id) return false
      if (folder === 'sent' && !t.has_outbound) return false
      if (q && !(`${t.subject} ${t.from_name} ${t.snippet}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [threads, folder, search])

  const active = threads.find((t) => t.gmail_thread_id === activeId) ?? null

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 96,
    overscan: 10,
    getItemKey: (index) => visible[index]?.gmail_thread_id ?? index,
  })

  const refreshThreads = useCallback(async () => {
    const { threads: fresh } = await apiFetch<{ threads: EmailThread[] }>('/api/inbox?folder=all')
    // Re-apply in-flight optimistic overrides so a refresh never stomps them.
    setThreads(fresh.map((t) => {
      const o = pendingRef.current.get(t.gmail_thread_id)
      return o ? { ...t, ...o } : t
    }))
  }, [])

  // Debounced server search: the client-side filter over loaded rows responds
  // instantly; a moment later we pull server matches (older threads beyond the
  // 800-row window) and merge them in, deduped by thread id and kept in order.
  useEffect(() => {
    const q = search.trim()
    if (!q) return
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const { threads: found } = await apiFetch<{ threads: EmailThread[] }>(
            `/api/inbox?folder=all&search=${encodeURIComponent(q)}`
          )
          setThreads((prev) => {
            const have = new Set(prev.map((t) => t.gmail_thread_id))
            const additions = found.filter((t) => !have.has(t.gmail_thread_id))
            if (additions.length === 0) return prev
            return [...prev, ...additions].sort((a, b) => b.last_at.localeCompare(a.last_at))
          })
        } catch {
          // Search is best-effort; the instant client-side filter still works.
        }
      })()
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  // Coalesce bursts (a single sync writes many rows) into one refresh.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { void refreshThreads() }, 600)
  }, [refreshThreads])

  // Push inbox: live-update the thread list as the gmail-sync cron writes mail.
  // email_logs is RLS-locked to is_admin(), and Realtime evaluates RLS against the
  // socket's JWT — so the realtime client must be authenticated with the user's
  // access token BEFORE we subscribe, or every change event is silently dropped
  // (the channel still reports SUBSCRIBED; only per-row delivery is denied).
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel('inbox:email_logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_logs' }, scheduleRefresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_logs' }, scheduleRefresh)
        .subscribe((status) => {
          setLiveStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'offline' : 'connecting')
        })
    })()

    return () => {
      cancelled = true
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [connected, supabase, scheduleRefresh])

  // Refresh on return to the tab so it's fresh even if a realtime event was missed.
  useEffect(() => {
    if (!connected) return
    function onVisible() { if (document.visibilityState === 'visible') scheduleRefresh() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [connected, scheduleRefresh])

  function openThread(t: EmailThread) {
    const id = t.gmail_thread_id
    setActiveId(id)
    setReply('')

    // Render cached messages instantly; only show the skeleton on a cold open.
    const cached = messageCacheRef.current.get(id)
    if (cached) {
      setMessages(cached)
      setLoadingMessages(false)
    } else {
      setMessages([])
      setLoadingMessages(true)
    }

    // Mark read locally the moment it's clicked; fire the read PATCH in the
    // background (with the same optimistic/revert machinery as other actions).
    if (t.is_unread) void runOptimistic(id, { is_unread: false }, 'read')

    // Refetch in the background, update cache + view if still the active thread.
    void (async () => {
      try {
        const { messages: msgs } = await apiFetch<{ messages: EmailLog[] }>(`/api/inbox/${id}`)
        messageCacheRef.current.set(id, msgs)
        if (activeIdRef.current === id) setMessages(msgs)
      } catch (err) {
        if (!cached && activeIdRef.current === id) setError(err instanceof Error ? err.message : 'Failed to open thread')
      } finally {
        if (activeIdRef.current === id) setLoadingMessages(false)
      }
    })()
  }

  function threadAction(action: string, extra?: Record<string, unknown>) {
    if (!active) return
    const id = active.gmail_thread_id
    let patch: Partial<EmailThread>
    switch (action) {
      case 'star': patch = { is_starred: true }; break
      case 'unstar': patch = { is_starred: false }; break
      case 'unread': patch = { is_unread: true }; break
      case 'read': patch = { is_unread: false }; break
      case 'archive': patch = { in_inbox: false }; break
      case 'unarchive': patch = { in_inbox: true }; break
      case 'link': patch = { account_id: String(extra?.account_id), account_name: accounts.find((a) => a.id === extra?.account_id)?.name ?? null, match_method: 'manual' }; break
      case 'unlink': patch = { account_id: null, account_name: null, match_method: 'unmatched' }; break
      default: return
    }
    void runOptimistic(id, patch, action, extra)
  }

  async function syncNow(sinceDays = 7) {
    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/gmail/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sinceDays }),
      })
      await refreshThreads()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendReply() {
    if (!active || !reply.trim() || messages.length === 0) return
    const last = messages[messages.length - 1]
    const to = last.direction === 'inbound' ? last.from_address : last.to_addresses?.[0]
    if (!to) { setError('No recipient found for reply'); return }
    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: active.subject.startsWith('Re:') ? active.subject : `Re: ${active.subject}`,
          body: reply.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') + (signature ? `<br><br>${signature}` : ''),
          reply_to_message_id: active.gmail_thread_id,
          account_id: active.account_id,
        }),
      })
      setReply('')
      const { messages: msgs } = await apiFetch<{ messages: EmailLog[] }>(`/api/inbox/${active.gmail_thread_id}`)
      messageCacheRef.current.set(active.gmail_thread_id, msgs)
      setMessages(msgs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <span className="topbar-title">Inbox</span>
        <span className="topbar-count">{counts.unread} unread</span>
        {connected ? (
          <span
            title={liveStatus === 'live' ? 'Live — inbox updates automatically' : liveStatus === 'connecting' ? 'Connecting to live updates…' : 'Live updates offline — will refresh on focus'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: liveStatus === 'live' ? 'var(--green, #16a34a)' : liveStatus === 'connecting' ? 'var(--amber, #d97706)' : 'var(--text-3)' }} />
            {liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>
        ) : null}
        <div className="topbar-actions">
          {!connected ? (
            <Link className="btn btn-primary btn-sm" href="/api/auth/google">Connect Gmail</Link>
          ) : (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setComposeOpen(true)}>✎ Compose</button>
              <button className="btn btn-ghost btn-sm" onClick={() => syncNow(7)} disabled={busy}>{busy ? 'Syncing…' : '↻ Sync now'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => syncNow(90)} disabled={busy}>Backfill 90d</button>
            </>
          )}
        </div>
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '6px 16px' }}>{error}</p> : null}

      {composeOpen ? (
        <ComposeModal
          contacts={contacts}
          accounts={accounts}
          signature={signature}
          onClose={() => setComposeOpen(false)}
          onSent={() => refreshThreads()}
        />
      ) : null}

      <div className="inbox">
        {/* folders */}
        <div className="folders">
          <div className="folder-label">Mailbox</div>
          {FOLDERS.map((f) => (
            <button key={f.key} className={`folder ${folder === f.key ? 'active' : ''}`} onClick={() => setFolder(f.key)}>
              <span>{f.icon}</span> {f.label}
              <span className="folder-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {/* thread list */}
        <div className="threads">
          <div className="threads-search">
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input className="search-input" placeholder="Search inbox…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="threads-list" ref={listRef}>
            {visible.length === 0 ? (
              connected && threads.length === 0 && busy ? (
                <ThreadListSkeleton />
              ) : (
                <div className="empty">{connected ? 'No threads. Try “Sync now”.' : 'Connect Gmail to load your inbox.'}</div>
              )
            ) : (
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
                {rowVirtualizer.getVirtualItems().map((vi) => {
                  const t = visible[vi.index]
                  if (!t) return null
                  return (
                    <div
                      key={vi.key}
                      data-index={vi.index}
                      ref={rowVirtualizer.measureElement}
                      className={`thread ${t.gmail_thread_id === activeId ? 'active' : ''} ${t.is_unread ? 'unread' : ''}`}
                      onClick={() => openThread(t)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                    >
                      <div className="thread-row">
                        <div className="thread-from">{t.is_starred ? '★ ' : ''}{t.from_name}</div>
                        <div className="thread-time">{timeLabel(t.last_at)}</div>
                      </div>
                      <div className="thread-subj">{t.subject}</div>
                      <div className="thread-snippet">{t.snippet}</div>
                      <div className="thread-tags">
                        {t.account_id ? (
                          <span className="acct-pill matched">◈ {t.account_name ?? 'Linked'}</span>
                        ) : (
                          <span className="acct-pill unmatched">⚠ Unmatched</span>
                        )}
                        {t.has_outbound ? <span className="acct-pill outbound">↗ Sent</span> : null}
                        {t.message_count > 1 ? <span className="thread-time">{t.message_count}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* reader */}
        <div className="reader">
          {!active ? (
            <div className="empty" style={{ margin: 'auto' }}>Select a thread to read.</div>
          ) : (
            <>
              <div className="reader-header">
                <div className="reader-subject">{active.subject}</div>
                <div className="reader-meta-row">
                  {active.account_id ? (
                    <Link className="acct-chip" href={`/crm/accounts/${active.account_id}`}>◈ {active.account_name ?? 'Account'}</Link>
                  ) : (
                    <select
                      className="filter-select"
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) threadAction('link', { account_id: e.target.value }) }}
                    >
                      <option value="">⚠ Unmatched — link to account…</option>
                      {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                    </select>
                  )}
                  <span className="meta-chip">{active.match_method ?? 'unmatched'}</span>
                  <span className="meta-chip">{active.message_count} message{active.message_count > 1 ? 's' : ''}</span>
                </div>
                <div className="reader-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.in_inbox ? 'archive' : 'unarchive')}>
                    {active.in_inbox ? '🗄 Archive' : '↩ Move to inbox'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.is_unread ? 'read' : 'unread')}>{active.is_unread ? 'Mark read' : 'Mark unread'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.is_starred ? 'unstar' : 'star')}>★ {active.is_starred ? 'Unstar' : 'Star'}</button>
                  {active.account_id ? <button className="btn btn-ghost btn-sm" onClick={() => threadAction('unlink')}>⚲ Unlink</button> : null}
                </div>
              </div>

              <div className="reader-body">
                {loadingMessages && messages.length === 0 ? <MessagesSkeleton /> : null}
                {messages.map((m) => (
                  <div className="message" key={m.id}>
                    <div className="message-head">
                      <div className={`avatar ${m.direction}`}>{initials(m.from_name || m.from_address)}</div>
                      <div style={{ flex: 1 }}>
                        <div className="msg-from">{m.from_name || m.from_address}</div>
                        <div className="msg-to">to {m.to_addresses?.join(', ') || '—'}</div>
                      </div>
                      <div className="msg-time">{m.received_at || m.sent_at ? timeLabel((m.received_at || m.sent_at)!) : ''}</div>
                    </div>
                    <div className="msg-body">
                      {m.body_html
                        ? <SafeEmailHtml html={m.body_html} />
                        : m.body_text
                          ? <pre className="whitespace-pre-wrap">{m.body_text}</pre>
                          : <span className="text-[color:var(--text-3)]">{m.snippet || '(no content)'}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="reader-reply">
                <textarea className="reply-input" placeholder={`Reply…`} value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="reply-actions">
                  <span className="meta-chip">Sends from {selfEmail || 'your Workspace mailbox'}</span>
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={sendReply} disabled={busy || !reply.trim()}>↗ Send reply</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Simple shimmer placeholders (no library) matching the .thmock surfaces.
const shimmer: CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3, var(--border)) 37%, var(--surface-2) 63%)',
  backgroundSize: '400% 100%',
  borderRadius: 6,
  animation: 'os-shimmer 1.4s ease infinite',
}

function ThreadListSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="thread" style={{ pointerEvents: 'none' }}>
          <div className="thread-row">
            <div style={{ ...shimmer, height: 12, flex: 1 }} />
            <div style={{ ...shimmer, height: 10, width: 34 }} />
          </div>
          <div style={{ ...shimmer, height: 13, width: '70%', marginTop: 6 }} />
          <div style={{ ...shimmer, height: 10, width: '90%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div className="message" key={i}>
          <div className="message-head">
            <div style={{ ...shimmer, width: 34, height: 34, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmer, height: 12, width: '40%' }} />
              <div style={{ ...shimmer, height: 10, width: '55%', marginTop: 6 }} />
            </div>
          </div>
          <div style={{ ...shimmer, height: 10, width: '95%', marginTop: 10 }} />
          <div style={{ ...shimmer, height: 10, width: '88%', marginTop: 6 }} />
          <div style={{ ...shimmer, height: 10, width: '60%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  )
}
