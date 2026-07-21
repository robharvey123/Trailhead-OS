'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import { apiFetch } from '@/lib/api-fetch'
import { createClient } from '@/lib/supabase/client'
import type { EmailLog, EmailThread } from '@/lib/types'

type LiveStatus = 'connecting' | 'live' | 'offline'
import ComposeModal, { type ComposePayload } from './ComposeModal'
import SafeEmailHtml from '../SafeEmailHtml'

type Named = { id: string; name: string }
type ContactOpt = { id: string; name: string; email: string | null; account_id: string | null }
type Folder = 'inbox' | 'unread' | 'all' | 'starred' | 'unmatched' | 'sent' | 'archived' | 'trash' | 'drafts' | 'scheduled'
type RemoteThread = EmailThread & { remote?: boolean }
type DraftSummary = { id: string; thread_id?: string; to: string; subject: string; snippet: string }
type ScheduledRow = { id: string; send_at: string; payload: { to?: string; subject?: string } }
type ComposeConfig = {
  title?: string
  to?: string[]
  cc?: string[]
  subject?: string
  body?: string
  attachments?: Array<{ filename: string; contentType: string; dataBase64: string }>
  threadId?: string
  inReplyTo?: string
  accountId?: string | null
  draftId?: string
  signature?: string
}

const FOLDERS: Array<{ key: Folder; label: string; icon: string }> = [
  { key: 'inbox', label: 'Inbox', icon: '📥' },
  { key: 'unread', label: 'Unread', icon: '✉' },
  { key: 'all', label: 'All', icon: '⊞' },
  { key: 'starred', label: 'Starred', icon: '★' },
  { key: 'unmatched', label: 'Unmatched', icon: '⚠' },
  { key: 'sent', label: 'Sent', icon: '↗' },
  { key: 'drafts', label: 'Drafts', icon: '📝' },
  { key: 'scheduled', label: 'Scheduled', icon: '⏰' },
  { key: 'archived', label: 'Archived', icon: '🗄' },
  { key: 'trash', label: 'Trash', icon: '🗑' },
]

// --- Undo send (client-side 10s delay) --------------------------------------
// The timer lives at MODULE scope so navigating away from /inbox within the app
// doesn't cancel a pending send. A beforeunload warning covers a real tab close.
const UNDO_MS = 10_000
let pendingSend: { payload: ComposePayload; timer: ReturnType<typeof setTimeout> } | null = null
let notifyAfterSend: (() => void) | null = null

function warnUnload(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = '' }

async function firePendingSend(payload: ComposePayload) {
  const json = (b: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  try {
    if (payload.draftId) {
      // Make sure the draft holds the final content (incl. attachments), then
      // send via drafts.send so Gmail cleans up the draft itself.
      await fetch(`/api/gmail/drafts/${payload.draftId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: payload.to, cc: payload.cc, bcc: payload.bcc, subject: payload.subject, body: payload.body, attachments: payload.attachments, thread_id: payload.thread_id, in_reply_to: payload.in_reply_to }),
      }).catch(() => {})
      await fetch(`/api/gmail/drafts/${payload.draftId}`, json({ to: payload.to, cc: payload.cc, bcc: payload.bcc, subject: payload.subject, body: payload.body, account_id: payload.account_id }))
    } else {
      await fetch('/api/gmail/send', json({ to: payload.to, cc: payload.cc, bcc: payload.bcc, subject: payload.subject, body: payload.body, attachments: payload.attachments, reply_to_message_id: payload.thread_id, account_id: payload.account_id }))
    }
  } finally {
    pendingSend = null
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', warnUnload)
    notifyAfterSend?.()
  }
}
function startUndoSend(payload: ComposePayload) {
  if (pendingSend) { clearTimeout(pendingSend.timer); void firePendingSend(pendingSend.payload) }
  window.addEventListener('beforeunload', warnUnload)
  pendingSend = { payload, timer: setTimeout(() => { void firePendingSend(payload) }, UNDO_MS) }
}
function cancelUndoSend(): ComposePayload | null {
  if (!pendingSend) return null
  clearTimeout(pendingSend.timer)
  window.removeEventListener('beforeunload', warnUnload)
  const p = pendingSend.payload
  pendingSend = null
  return p
}

// Bulk actions and their labels for the selection bar.
const BULK_ACTIONS: Array<{ action: string; label: string }> = [
  { action: 'archive', label: '🗄 Archive' },
  { action: 'read', label: 'Mark read' },
  { action: 'unread', label: 'Mark unread' },
  { action: 'star', label: '★ Star' },
  { action: 'trash', label: '🗑 Trash' },
]

const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: 'j / k', desc: 'Move down / up' },
  { keys: 'Enter / o', desc: 'Open thread' },
  { keys: 'e', desc: 'Archive' },
  { keys: 's', desc: 'Star' },
  { keys: 'r', desc: 'Reply' },
  { keys: 'a', desc: 'Reply all' },
  { keys: 'f', desc: 'Forward' },
  { keys: 'Shift + U', desc: 'Mark unread' },
  { keys: '#', desc: 'Trash' },
  { keys: 'x', desc: 'Select / deselect' },
  { keys: '/', desc: 'Search' },
  { keys: 'c', desc: 'Compose' },
  { keys: 'Esc', desc: 'Close / deselect' },
  { keys: '?', desc: 'This help' },
]

function formatSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

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
  selfEmails = [],
  signature = '',
}: {
  initialThreads: EmailThread[]
  accounts: Named[]
  contacts: ContactOpt[]
  connected: boolean
  selfEmail: string
  selfEmails?: string[]
  signature?: string
}) {
  const [composeConfig, setComposeConfig] = useState<ComposeConfig | null>(null)
  const [undoPayload, setUndoPayload] = useState<ComposePayload | null>(null)
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([])
  const [remoteResults, setRemoteResults] = useState<RemoteThread[]>([])
  const [remoteActive, setRemoteActive] = useState<RemoteThread | null>(null)
  const [searchingAll, setSearchingAll] = useState(false)
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cursorIndex, setCursorIndex] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [replyAllMode, setReplyAllMode] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const visibleRef = useRef<EmailThread[]>([])
  const cursorIndexRef = useRef(0)
  useEffect(() => { cursorIndexRef.current = cursorIndex }, [cursorIndex])
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {})

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
    inbox: threads.filter((t) => t.in_inbox && !t.in_trash).length,
    unread: threads.filter((t) => t.is_unread && t.in_inbox && !t.in_trash).length,
    all: threads.filter((t) => !t.in_trash).length,
    starred: threads.filter((t) => t.is_starred && !t.in_trash).length,
    unmatched: threads.filter((t) => !t.account_id && !t.in_trash).length,
    sent: threads.filter((t) => t.has_outbound && !t.in_trash).length,
    archived: threads.filter((t) => !t.in_inbox && !t.in_trash).length,
    trash: threads.filter((t) => t.in_trash).length,
    drafts: drafts.length,
    scheduled: scheduled.length,
  }), [threads, drafts.length, scheduled.length])

  const visible = useMemo(() => {
    // Drafts/Scheduled are their own lists (not email_logs threads).
    if (folder === 'drafts' || folder === 'scheduled') return []
    const q = search.trim().toLowerCase()
    return threads.filter((t) => {
      if (folder === 'trash') {
        if (!t.in_trash) return false
      } else {
        if (t.in_trash) return false
        if (folder === 'inbox' && !t.in_inbox) return false
        if (folder === 'archived' && t.in_inbox) return false
        if (folder === 'unread' && !(t.is_unread && t.in_inbox)) return false
        if (folder === 'starred' && !t.is_starred) return false
        if (folder === 'unmatched' && t.account_id) return false
        if (folder === 'sent' && !t.has_outbound) return false
      }
      if (q && !(`${t.subject} ${t.from_name} ${t.snippet}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [threads, folder, search])
  useEffect(() => { visibleRef.current = visible }, [visible])
  // Reset Gmail-search results whenever the query text changes.
  useEffect(() => { setRemoteResults([]) }, [search])

  const active: RemoteThread | null = threads.find((t) => t.gmail_thread_id === activeId) ?? remoteActive

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

  function openThread(t: RemoteThread) {
    const id = t.gmail_thread_id
    setActiveId(id)
    setReply('')
    // Remote (Gmail-search) results aren't in email_logs — fetch live and keep a
    // synthesized active thread so the reader can render them.
    setRemoteActive(t.remote ? t : null)
    const endpoint = t.remote ? `/api/gmail/thread/${id}` : `/api/inbox/${id}`

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
    if (t.is_unread && !t.remote) void runOptimistic(id, { is_unread: false }, 'read')

    // Refetch in the background, update cache + view if still the active thread.
    void (async () => {
      try {
        const { messages: msgs } = await apiFetch<{ messages: EmailLog[] }>(endpoint)
        messageCacheRef.current.set(id, msgs)
        if (activeIdRef.current === id) setMessages(msgs)
      } catch (err) {
        if (!cached && activeIdRef.current === id) setError(err instanceof Error ? err.message : 'Failed to open thread')
      } finally {
        if (activeIdRef.current === id) setLoadingMessages(false)
      }
    })()
  }

  // --- Undo send + schedule + drafts + full search --------------------------

  function composePayloadToConfig(p: ComposePayload): ComposeConfig {
    return {
      to: p.to ? p.to.split(',').map((x) => x.trim()).filter(Boolean) : [],
      cc: p.cc ? p.cc.split(',').map((x) => x.trim()).filter(Boolean) : [],
      subject: p.subject,
      body: p.body, // already includes signature; pass signature:'' so it isn't doubled
      attachments: p.attachments,
      threadId: p.thread_id,
      inReplyTo: p.in_reply_to,
      accountId: p.account_id,
      draftId: p.draftId ?? undefined,
      signature: '',
      title: 'Edit before sending',
    }
  }

  // ComposeModal hands us the resolved payload; defer the real send by 10s.
  function handleUndoSend(payload: ComposePayload) {
    startUndoSend(payload)
    setUndoPayload(payload)
  }
  function undoSend() {
    const p = cancelUndoSend()
    setUndoPayload(null)
    if (p) setComposeConfig(composePayloadToConfig(p))
  }
  // Auto-dismiss the toast when the send actually fires (UI only; timer is module-level).
  useEffect(() => {
    if (!undoPayload) return
    const h = setTimeout(() => setUndoPayload(null), UNDO_MS)
    return () => clearTimeout(h)
  }, [undoPayload])
  // Let a module-level send refresh the list while we're mounted.
  useEffect(() => {
    notifyAfterSend = () => { void refreshThreads() }
    return () => { notifyAfterSend = null }
  }, [refreshThreads])

  async function handleSchedule(payload: ComposePayload, sendAtIso: string) {
    try {
      const { error: insErr } = await supabase.from('scheduled_emails').insert({
        payload: {
          to: payload.to, cc: payload.cc, bcc: payload.bcc, subject: payload.subject,
          body_html: payload.body, attachments: payload.attachments,
          in_reply_to: payload.thread_id, account_id: payload.account_id,
        },
        send_at: sendAtIso,
      })
      if (insErr) throw new Error(insErr.message)
      void loadScheduled()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    }
  }

  const loadDrafts = useCallback(async () => {
    try {
      const { drafts: d } = await apiFetch<{ drafts: DraftSummary[] }>('/api/gmail/drafts')
      setDrafts(d)
    } catch { /* ignore */ }
  }, [])
  const loadScheduled = useCallback(async () => {
    try {
      const { data } = await supabase.from('scheduled_emails').select('id, send_at, payload').eq('status', 'pending').order('send_at', { ascending: true })
      setScheduled((data ?? []) as ScheduledRow[])
    } catch { /* ignore */ }
  }, [supabase])
  useEffect(() => {
    if (folder === 'drafts') void loadDrafts()
    if (folder === 'scheduled') void loadScheduled()
  }, [folder, loadDrafts, loadScheduled])

  async function openDraft(id: string) {
    try {
      const { draft } = await apiFetch<{ draft: { id: string; thread_id?: string; to: string[]; cc: string[]; subject: string; body_html: string | null } }>(`/api/gmail/drafts/${id}`)
      setComposeConfig({
        title: 'Edit draft', to: draft.to, cc: draft.cc, subject: draft.subject,
        body: draft.body_html ?? '', threadId: draft.thread_id, draftId: draft.id, signature: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open draft')
    }
  }
  async function cancelScheduled(id: string) {
    setScheduled((prev) => prev.filter((s) => s.id !== id))
    try {
      await supabase.from('scheduled_emails').update({ status: 'cancelled' }).eq('id', id)
    } catch { void loadScheduled() }
  }

  async function searchAllMail() {
    const q = search.trim()
    if (!q) return
    setSearchingAll(true)
    try {
      const { threads: found } = await apiFetch<{ threads: RemoteThread[] }>(`/api/gmail/search?q=${encodeURIComponent(q)}`)
      // Drop any that are already visible locally.
      const localIds = new Set(threadsRef.current.map((t) => t.gmail_thread_id))
      setRemoteResults(found.filter((t) => !localIds.has(t.gmail_thread_id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gmail search failed')
    } finally {
      setSearchingAll(false)
    }
  }

  function patchFor(action: string, extra?: Record<string, unknown>): Partial<EmailThread> | null {
    switch (action) {
      case 'star': return { is_starred: true }
      case 'unstar': return { is_starred: false }
      case 'unread': return { is_unread: true }
      case 'read': return { is_unread: false }
      case 'archive': return { in_inbox: false }
      case 'unarchive': return { in_inbox: true }
      case 'trash': return { in_trash: true, in_inbox: false }
      case 'untrash': return { in_trash: false, in_inbox: true }
      case 'link': return { account_id: String(extra?.account_id), account_name: accounts.find((a) => a.id === extra?.account_id)?.name ?? null, match_method: 'manual' }
      case 'unlink': return { account_id: null, account_name: null, match_method: 'unmatched' }
      default: return null
    }
  }
  function actOnThread(id: string, action: string, extra?: Record<string, unknown>) {
    const patch = patchFor(action, extra)
    if (!patch) return
    void runOptimistic(id, patch, action, extra)
  }
  function threadAction(action: string, extra?: Record<string, unknown>) {
    if (!active) return
    actOnThread(active.gmail_thread_id, action, extra)
  }

  /** Bulk-apply an action across the selected threads via /api/inbox/bulk. */
  async function bulkAction(action: string) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const patch = patchFor(action)
    if (!patch) return
    const snapshots = new Map<string, EmailThread>()
    for (const id of ids) {
      const snap = threadsRef.current.find((t) => t.gmail_thread_id === id)
      if (snap) { snapshots.set(id, snap); mergePending(id, patch); applyOverride(id, patch) }
    }
    setSelected(new Set())
    function revert(id: string) {
      clearPending(id, patch!)
      const snap = snapshots.get(id)
      if (snap) setThreads((prev) => prev.map((x) => (x.gmail_thread_id === id ? snap : x)))
    }
    try {
      const res = await apiFetch<{ failures?: Array<{ thread_id: string }> }>('/api/inbox/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_ids: ids, action }),
      })
      for (const id of ids) clearPending(id, patch)
      const failures = res.failures ?? []
      failures.forEach((f) => revert(f.thread_id))
      if (failures.length) setError(`${failures.length} thread(s) failed`)
    } catch (err) {
      ids.forEach(revert)
      setError(err instanceof Error ? err.message : 'Bulk action failed')
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
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

  async function sendReply(replyAll = false) {
    if (!active || !reply.trim() || messages.length === 0) return
    const last = messages[messages.length - 1]
    const primaryTo = last.direction === 'inbound' ? last.from_address : (last.to_addresses?.[0] ?? '')
    if (!primaryTo) { setError('No recipient found for reply'); return }

    // Reply-all: everyone on the latest message (From + To + Cc) minus our own
    // addresses and the primary recipient.
    let cc: string | undefined
    if (replyAll) {
      const self = new Set(selfEmails.map((e) => e.toLowerCase()))
      const everyone = [last.from_address, ...(last.to_addresses ?? []), ...(last.cc_addresses ?? [])]
      const ccList = Array.from(new Set(everyone.map((e) => e.trim().toLowerCase())))
        .filter((e) => e && e !== primaryTo.toLowerCase() && !self.has(e))
      cc = ccList.join(',') || undefined
    }

    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: primaryTo,
          cc,
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

  /** Open ComposeModal pre-filled to forward the latest message, re-attaching its files. */
  async function startForward() {
    if (!active || messages.length === 0) return
    const last = messages[messages.length - 1]
    const when = last.received_at || last.sent_at || last.created_at
    const quoted = [
      '', '',
      '---------- Forwarded message ----------',
      `From: ${last.from_name || last.from_address} <${last.from_address}>`,
      `Date: ${when ? new Date(when).toLocaleString('en-GB') : ''}`,
      `Subject: ${active.subject}`,
      `To: ${(last.to_addresses ?? []).join(', ')}`,
      '',
      last.body_text || last.snippet || '',
    ].join('\n')
    const subject = active.subject.startsWith('Fwd:') ? active.subject : `Fwd: ${active.subject}`

    setBusy(true)
    setError('')
    try {
      const attachments = await Promise.all(
        (last.attachments ?? []).map(async (a) => {
          const res = await fetch(`/api/gmail/attachments/${last.gmail_message_id}/${a.attachment_id}`)
          if (!res.ok) throw new Error('Failed to fetch attachment')
          const buf = await res.arrayBuffer()
          return { filename: a.filename, contentType: a.mime_type, dataBase64: arrayBufferToBase64(buf) }
        })
      )
      setComposeConfig({ title: 'Forward', subject, body: quoted, attachments, accountId: active.account_id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare forward')
    } finally {
      setBusy(false)
    }
  }

  /** Pop the plain-text reply out into the rich-text ComposeModal (threading preserved). */
  function popOutReply() {
    if (!active) return
    const last = messages[messages.length - 1]
    const primaryTo = last ? (last.direction === 'inbound' ? last.from_address : (last.to_addresses?.[0] ?? '')) : ''
    setComposeConfig({
      title: 'Reply',
      to: primaryTo ? [primaryTo] : [],
      subject: active.subject.startsWith('Re:') ? active.subject : `Re: ${active.subject}`,
      body: reply,
      threadId: active.gmail_thread_id,
      accountId: active.account_id,
    })
    setReply('')
  }

  // Latest-ref pattern: the listener is attached once but always runs the freshest
  // closure, so shortcuts see current `active`/`reply`/selection without re-binding.
  keyHandlerRef.current = (e: KeyboardEvent) => {
    // Never swallow browser/OS shortcuts.
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const el = e.target as HTMLElement | null
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    if (typing) {
      if (e.key === 'Escape') el!.blur()
      return
    }
    const list = visibleRef.current
    const cursorThread = list[cursorIndexRef.current] ?? null
    // Actions target the open thread if there is one, else the cursor row.
    const target = active ?? cursorThread

    switch (e.key) {
      case 'j': e.preventDefault(); setCursorIndex((i) => Math.min(list.length - 1, i + 1)); break
      case 'k': e.preventDefault(); setCursorIndex((i) => Math.max(0, i - 1)); break
      case 'o': case 'Enter': if (cursorThread) { e.preventDefault(); openThread(cursorThread) } break
      case 'e': if (target) { e.preventDefault(); actOnThread(target.gmail_thread_id, target.in_inbox ? 'archive' : 'unarchive') } break
      case 's': if (target) { e.preventDefault(); actOnThread(target.gmail_thread_id, target.is_starred ? 'unstar' : 'star') } break
      case '#': if (target) { e.preventDefault(); actOnThread(target.gmail_thread_id, target.in_trash ? 'untrash' : 'trash') } break
      case 'U': if (e.shiftKey && target) { e.preventDefault(); actOnThread(target.gmail_thread_id, 'unread') } break
      case 'r': if (active) { e.preventDefault(); setReplyAllMode(false); replyRef.current?.focus() } break
      case 'a': if (active) { e.preventDefault(); setReplyAllMode(true); replyRef.current?.focus() } break
      case 'f': if (active) { e.preventDefault(); void startForward() } break
      case 'x': if (cursorThread) { e.preventDefault(); toggleSelect(cursorThread.gmail_thread_id) } break
      case '/': e.preventDefault(); searchRef.current?.focus(); break
      case 'c': e.preventDefault(); setComposeConfig({}); break
      case '?': e.preventDefault(); setShowHelp((s) => !s); break
      case 'Escape':
        if (showHelp) setShowHelp(false)
        else if (active) setActiveId(null)
        else if (selected.size) setSelected(new Set())
        break
      default: break
    }
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyHandlerRef.current(e)
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  // Keep the keyboard cursor row scrolled into view (virtualizer, not DOM scroll).
  useEffect(() => {
    if (visible.length > 0) rowVirtualizer.scrollToIndex(Math.min(cursorIndex, visible.length - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorIndex])

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
              <button className="btn btn-primary btn-sm" onClick={() => setComposeConfig({})}>✎ Compose</button>
              <button className="btn btn-ghost btn-sm" onClick={() => syncNow(7)} disabled={busy}>{busy ? 'Syncing…' : '↻ Sync now'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => syncNow(90)} disabled={busy}>Backfill 90d</button>
              <button className="btn btn-ghost btn-sm" title="Keyboard shortcuts" onClick={() => setShowHelp(true)}>⌨ ?</button>
            </>
          )}
        </div>
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '6px 16px' }}>{error}</p> : null}

      {composeConfig ? (
        <ComposeModal
          contacts={contacts}
          accounts={accounts}
          title={composeConfig.title}
          signature={composeConfig.signature ?? signature}
          initialTo={composeConfig.to}
          initialCc={composeConfig.cc}
          initialSubject={composeConfig.subject}
          initialBody={composeConfig.body}
          initialAttachments={composeConfig.attachments}
          threadId={composeConfig.threadId}
          inReplyTo={composeConfig.inReplyTo}
          accountId={composeConfig.accountId}
          draftId={composeConfig.draftId}
          onSend={handleUndoSend}
          onSchedule={handleSchedule}
          onClose={() => { setComposeConfig(null); void refreshThreads() }}
          onSent={() => { setComposeConfig(null); void refreshThreads(); if (folder === 'scheduled') void loadScheduled() }}
        />
      ) : null}

      {undoPayload ? (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 80 }}
          className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--text)] px-4 py-2.5 text-sm text-white shadow-lg">
          <span>Sending…</span>
          <button className="font-semibold underline" onClick={undoSend}>Undo</button>
        </div>
      ) : null}

      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setShowHelp(false)}>
          <div className="rounded-[8px] border border-[var(--border)] bg-white p-5" style={{ minWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--text)]">Keyboard shortcuts</h2>
              <button onClick={() => setShowHelp(false)} className="text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
            </div>
            <div className="mt-3 space-y-1.5">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-6">
                  <span className="text-sm text-[var(--text-2)]">{s.desc}</span>
                  <kbd className="meta-chip">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
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
              <input ref={searchRef} className="search-input" placeholder="Search inbox… (Enter for all mail)" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchAllMail() } }} />
            </div>
            {selected.size > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span className="meta-chip">{selected.size} selected</span>
                {BULK_ACTIONS.map((b) => (
                  <button key={b.action} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => bulkAction(b.action)}>{b.label}</button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                <input
                  type="checkbox"
                  checked={visible.length > 0 && visible.every((t) => selected.has(t.gmail_thread_id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((t) => t.gmail_thread_id)) : new Set())}
                />
                Select all visible
              </label>
            )}
          </div>
          <div className="threads-list" ref={listRef}>
            {folder === 'drafts' ? (
              drafts.length === 0 ? (
                <div className="empty">No drafts. They sync from Gmail everywhere.</div>
              ) : (
                drafts.map((d) => (
                  <div key={d.id} className="thread" onClick={() => void openDraft(d.id)}>
                    <div className="thread-row"><div className="thread-from">To: {d.to || '—'}</div></div>
                    <div className="thread-subj">{d.subject || '(no subject)'}</div>
                    <div className="thread-snippet">{d.snippet}</div>
                  </div>
                ))
              )
            ) : folder === 'scheduled' ? (
              scheduled.length === 0 ? (
                <div className="empty">Nothing scheduled.</div>
              ) : (
                scheduled.map((s) => (
                  <div key={s.id} className="thread" style={{ cursor: 'default' }}>
                    <div className="thread-row">
                      <div className="thread-from">To: {s.payload?.to || '—'}</div>
                      <div className="thread-time">{new Date(s.send_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="thread-subj">{s.payload?.subject || '(no subject)'}</div>
                    <div className="thread-tags">
                      <button className="btn btn-ghost btn-sm" onClick={() => void cancelScheduled(s.id)}>Cancel</button>
                    </div>
                  </div>
                ))
              )
            ) : visible.length === 0 && remoteResults.length === 0 ? (
              connected && threads.length === 0 && busy ? (
                <ThreadListSkeleton />
              ) : (
                <div className="empty">
                  {!connected ? 'Connect Gmail to load your inbox.' : folder === 'trash' ? 'Trash shows locally trashed mail (Gmail purges it after 30 days).' : 'No threads. Try “Sync now”.'}
                  {connected && search.trim() ? (
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => void searchAllMail()} disabled={searchingAll}>{searchingAll ? 'Searching…' : '🔍 Search all mail'}</button>
                    </div>
                  ) : null}
                </div>
              )
            ) : (
              <>
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
                        style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)`,
                          outline: vi.index === cursorIndex ? '2px solid var(--accent)' : undefined,
                          outlineOffset: -2,
                        }}
                      >
                        <div className="thread-row">
                          <input
                            type="checkbox"
                            checked={selected.has(t.gmail_thread_id)}
                            onChange={() => toggleSelect(t.gmail_thread_id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginRight: 6 }}
                            aria-label="Select thread"
                          />
                          <div className="thread-from">{t.is_starred ? '★ ' : ''}{t.from_name}</div>
                          <div className="thread-time">{t.has_attachments ? '📎 ' : ''}{timeLabel(t.last_at)}</div>
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

                {/* Full-mailbox Gmail search results (not in email_logs). */}
                {search.trim() ? (
                  <div className="thread" style={{ cursor: 'default', textAlign: 'center' }} onClick={() => void searchAllMail()}>
                    <button className="btn btn-ghost btn-sm" disabled={searchingAll}>{searchingAll ? 'Searching…' : '🔍 Search all mail'}</button>
                  </div>
                ) : null}
                {remoteResults.length > 0 ? (
                  <div className="folder-label" style={{ padding: '8px 14px' }}>From Gmail</div>
                ) : null}
                {remoteResults.map((t) => (
                  <div key={`remote-${t.gmail_thread_id}`} className={`thread ${t.gmail_thread_id === activeId ? 'active' : ''} ${t.is_unread ? 'unread' : ''}`} onClick={() => openThread(t)}>
                    <div className="thread-row">
                      <div className="thread-from">{t.from_name}</div>
                      <div className="thread-time">{t.has_attachments ? '📎 ' : ''}{timeLabel(t.last_at)}</div>
                    </div>
                    <div className="thread-subj">{t.subject}</div>
                    <div className="thread-snippet">{t.snippet}</div>
                    <div className="thread-tags"><span className="acct-pill outbound">from Gmail</span></div>
                  </div>
                ))}
              </>
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
                  {active.in_trash ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => threadAction('untrash')}>↩ Restore</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.in_inbox ? 'archive' : 'unarchive')}>
                      {active.in_inbox ? '🗄 Archive' : '↩ Move to inbox'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction('trash')} disabled={active.in_trash}>🗑 Trash</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.is_unread ? 'read' : 'unread')}>{active.is_unread ? 'Mark read' : 'Mark unread'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => threadAction(active.is_starred ? 'unstar' : 'star')}>★ {active.is_starred ? 'Unstar' : 'Star'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={startForward} disabled={busy || messages.length === 0}>➦ Forward</button>
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
                    {(m.attachments ?? []).length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {m.attachments!.map((a) => (
                          <a
                            key={a.attachment_id}
                            className="tag-chip grey"
                            href={`/api/gmail/attachments/${m.gmail_message_id}/${a.attachment_id}`}
                            download={a.filename}
                          >
                            📎 {a.filename}{a.size_bytes ? ` · ${formatSize(a.size_bytes)}` : ''}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="reader-reply">
                <textarea ref={replyRef} className="reply-input" placeholder={replyAllMode ? 'Reply all…' : 'Reply…'} value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="reply-actions">
                  <span className="meta-chip">Sends from {selfEmail || 'your Workspace mailbox'}</span>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={popOutReply} title="Rich-text compose" disabled={!active}>⤢ Pop out</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => sendReply(true)} disabled={busy || !reply.trim()}>↗ Reply all</button>
                  <button className="btn btn-primary btn-sm" onClick={() => sendReply(false)} disabled={busy || !reply.trim()}>↗ Send reply</button>
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
