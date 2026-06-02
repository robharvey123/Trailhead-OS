'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-fetch'
import type { EmailLog, EmailThread } from '@/lib/types'
import ComposeModal from './ComposeModal'

type Named = { id: string; name: string }
type ContactOpt = { id: string; name: string; email: string | null; account_id: string | null }
type Folder = 'unread' | 'all' | 'starred' | 'unmatched' | 'sent'

const FOLDERS: Array<{ key: Folder; label: string; icon: string }> = [
  { key: 'unread', label: 'Unread', icon: '✉' },
  { key: 'all', label: 'All', icon: '⊞' },
  { key: 'starred', label: 'Starred', icon: '★' },
  { key: 'unmatched', label: 'Unmatched', icon: '⚠' },
  { key: 'sent', label: 'Sent', icon: '↗' },
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
}: {
  initialThreads: EmailThread[]
  accounts: Named[]
  contacts: ContactOpt[]
  connected: boolean
  selfEmail: string
}) {
  const [composeOpen, setComposeOpen] = useState(false)
  const [threads, setThreads] = useState(initialThreads)
  const [folder, setFolder] = useState<Folder>('all')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<EmailLog[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const counts = useMemo(() => ({
    unread: threads.filter((t) => t.is_unread).length,
    all: threads.length,
    starred: threads.filter((t) => t.is_starred).length,
    unmatched: threads.filter((t) => !t.account_id).length,
    sent: threads.filter((t) => t.has_outbound).length,
  }), [threads])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return threads.filter((t) => {
      if (folder === 'unread' && !t.is_unread) return false
      if (folder === 'starred' && !t.is_starred) return false
      if (folder === 'unmatched' && t.account_id) return false
      if (folder === 'sent' && !t.has_outbound) return false
      if (q && !(`${t.subject} ${t.from_name} ${t.snippet}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [threads, folder, search])

  const active = threads.find((t) => t.gmail_thread_id === activeId) ?? null

  async function refreshThreads() {
    const { threads: fresh } = await apiFetch<{ threads: EmailThread[] }>('/api/inbox?folder=all')
    setThreads(fresh)
  }

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
          body: reply.replace(/\n/g, '<br>'),
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
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.is_starred ? 'unstar' : 'star')}>★ {active.is_starred ? 'Unstar' : 'Star'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction('unread')}>Mark unread</button>
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
                    <div className="msg-body">{m.body_text || m.snippet || '(no content)'}</div>
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
