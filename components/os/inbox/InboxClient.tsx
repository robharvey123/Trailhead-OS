'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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
  const supabase = useMemo(() => createClient(), [])
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const refreshThreads = useCallback(async () => {
    const { threads: fresh } = await apiFetch<{ threads: EmailThread[] }>('/api/inbox?folder=all')
    setThreads(fresh)
  }, [])

  // Coalesce bursts (a single sync writes many rows) into one refresh.
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { void refreshThreads() }, 600)
  }, [refreshThreads])

  // Push inbox: live-update the thread list as the gmail-sync cron writes mail.
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
    })()

    const channel = supabase
      .channel('inbox:email_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_logs' }, scheduleRefresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_logs' }, scheduleRefresh)
      .subscribe((status) => {
        setLiveStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'offline' : 'connecting')
      })

    return () => {
      cancelled = true
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
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

  async function openThread(t: EmailThread) {
    setActiveId(t.gmail_thread_id)
    setMessages([])
    setReply('')
    try {
      const { messages: msgs } = await apiFetch<{ messages: EmailLog[] }>(`/api/inbox/${t.gmail_thread_id}`)
      setMessages(msgs)
      if (t.is_unread) {
        await apiFetch(`/api/inbox/${t.gmail_thread_id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read' }),
        })
        setThreads((prev) => prev.map((x) => (x.gmail_thread_id === t.gmail_thread_id ? { ...x, is_unread: false } : x)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open thread')
    }
  }

  async function threadAction(action: string, extra?: Record<string, unknown>) {
    if (!active) return
    try {
      await apiFetch(`/api/inbox/${active.gmail_thread_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }),
      })
      setThreads((prev) => prev.map((x) => {
        if (x.gmail_thread_id !== active.gmail_thread_id) return x
        if (action === 'star') return { ...x, is_starred: true }
        if (action === 'unstar') return { ...x, is_starred: false }
        if (action === 'unread') return { ...x, is_unread: true }
        if (action === 'read') return { ...x, is_unread: false }
        if (action === 'archive') return { ...x, in_inbox: false }
        if (action === 'unarchive') return { ...x, in_inbox: true }
        if (action === 'link') return { ...x, account_id: String(extra?.account_id), account_name: accounts.find((a) => a.id === extra?.account_id)?.name ?? null, match_method: 'manual' }
        if (action === 'unlink') return { ...x, account_id: null, account_name: null, match_method: 'unmatched' }
        return x
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
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
          <div className="threads-list">
            {visible.length === 0 ? (
              <div className="empty">{connected ? 'No threads. Try “Sync now”.' : 'Connect Gmail to load your inbox.'}</div>
            ) : (
              visible.map((t) => (
                <div
                  key={t.gmail_thread_id}
                  className={`thread ${t.gmail_thread_id === activeId ? 'active' : ''} ${t.is_unread ? 'unread' : ''}`}
                  onClick={() => openThread(t)}
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
              ))
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
