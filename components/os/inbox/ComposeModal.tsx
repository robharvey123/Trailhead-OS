'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import RichTextEditor from './RichTextEditor'

type ContactOpt = { id: string; name: string; email: string | null; account_id: string | null }
type Named = { id: string; name: string }
type Recipient = { email: string; name?: string; inCrm: boolean; accountId?: string | null }
type Field = 'to' | 'cc' | 'bcc'
type PreAttachment = { filename: string; contentType: string; dataBase64: string }

export type ComposePayload = {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  attachments: PreAttachment[]
  thread_id?: string
  in_reply_to?: string
  account_id?: string | null
  draftId?: string | null
}

function suggestAccountName(email: string) {
  const base = (email.split('@')[1] || '').split('.')[0] || ''
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim()
}
function at8am(base: Date) {
  const d = new Date(base)
  d.setHours(8, 0, 0, 0)
  return d
}
function nextTomorrow8() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return at8am(d)
}
function nextMonday8() {
  const d = new Date()
  const add = ((1 - d.getDay() + 7) % 7) || 7
  d.setDate(d.getDate() + add)
  return at8am(d)
}
function labelFor(d: Date) {
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ComposeModal({
  contacts, accounts, initialTo = [], initialCc = [], initialSubject = '', initialBody = '',
  initialAttachments = [], title = 'New email', signature = '', threadId, inReplyTo, accountId = null,
  draftId, onSend, onSchedule, onClose, onSent,
}: {
  contacts: ContactOpt[]
  accounts: Named[]
  initialTo?: string[]
  initialCc?: string[]
  initialSubject?: string
  initialBody?: string
  initialAttachments?: PreAttachment[]
  title?: string
  signature?: string
  threadId?: string
  inReplyTo?: string
  accountId?: string | null
  draftId?: string
  onSend?: (payload: ComposePayload) => void
  onSchedule?: (payload: ComposePayload, sendAtIso: string) => void
  onClose: () => void
  onSent: () => void
}) {
  const byEmail = useMemo(() => new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c])), [contacts])
  const toR = (emails: string[]): Recipient[] => emails.map((e) => {
    const c = byEmail.get(e.toLowerCase())
    return c ? { email: e, name: c.name, inCrm: true, accountId: c.account_id } : { email: e, inCrm: false }
  })

  const [to, setTo] = useState<Recipient[]>(toR(initialTo))
  const [cc, setCc] = useState<Recipient[]>(toR(initialCc))
  const [bcc, setBcc] = useState<Recipient[]>([])
  const [queries, setQueries] = useState<Record<Field, string>>({ to: '', cc: '', bcc: '' })
  const [showBcc, setShowBcc] = useState(false)
  const [subject, setSubject] = useState(initialSubject)
  // Seed the rich-text editor: forward/reply pass plain text, convert to HTML paras.
  const initialHtml = useMemo(() => {
    if (!initialBody) return ''
    if (/<[a-z][\s\S]*>/i.test(initialBody)) return initialBody
    return initialBody.split('\n').map((l) => `<p>${l ? l.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '<br>'}</p>`).join('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [bodyHtml, setBodyHtml] = useState(initialHtml)
  const [files, setFiles] = useState<File[]>([])
  const [preAttachments, setPreAttachments] = useState<PreAttachment[]>(initialAttachments)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [addList, setAddList] = useState<Array<{ email: string; add: boolean; name: string; account: string }> | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [pickTime, setPickTime] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)

  const draftsEnabled = Boolean(onSend)
  const draftIdRef = useRef<string | null>(draftId ?? null)
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())

  const value = (f: Field) => (f === 'to' ? to : f === 'cc' ? cc : bcc)
  const set = (f: Field) => (f === 'to' ? setTo : f === 'cc' ? setCc : setBcc)
  const input = 'rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  function addRecipient(f: Field, r: Recipient) {
    set(f)((prev) => prev.some((x) => x.email.toLowerCase() === r.email.toLowerCase()) ? prev : [...prev, r])
    setQueries((q) => ({ ...q, [f]: '' }))
  }
  function commitFreeText(f: Field) {
    const e = queries[f].trim()
    if (!e || !e.includes('@')) return
    const c = byEmail.get(e.toLowerCase())
    addRecipient(f, c ? { email: e, name: c.name, inCrm: true, accountId: c.account_id } : { email: e, inCrm: false })
  }

  // --- Draft autosave: 2s debounce; serialized so update never races create ---
  function draftBody(): Omit<ComposePayload, 'account_id' | 'draftId'> {
    return {
      to: to.map((r) => r.email).join(','),
      cc: cc.map((r) => r.email).join(','),
      bcc: bcc.map((r) => r.email).join(','),
      subject,
      body: bodyHtml,
      attachments: preAttachments,
      thread_id: threadId,
      in_reply_to: inReplyTo,
    }
  }
  function saveDraftNow() {
    const payload = draftBody()
    saveChainRef.current = saveChainRef.current.then(async () => {
      try {
        if (draftIdRef.current) {
          await apiFetch(`/api/gmail/drafts/${draftIdRef.current}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        } else {
          const res = await apiFetch<{ id: string }>('/api/gmail/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          draftIdRef.current = res.id
        }
        setDraftSaved(true)
      } catch { /* autosave is best-effort */ }
    })
  }
  useEffect(() => {
    if (!draftsEnabled) return
    const empty = to.length === 0 && cc.length === 0 && bcc.length === 0 && !subject.trim() && !stripHtml(bodyHtml)
    if (empty && !draftIdRef.current) return
    setDraftSaved(false)
    const handle = setTimeout(saveDraftNow, 2000)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, bcc, subject, bodyHtml, draftsEnabled])

  function renderField(f: Field, label: string) {
    const recips = value(f)
    const q = queries[f]
    const matches = q.trim()
      ? contacts.filter((c) => c.email && `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()) && !recips.some((r) => r.email.toLowerCase() === c.email!.toLowerCase())).slice(0, 6)
      : []
    return (
      <div style={{ position: 'relative' }}>
        <div className="flex flex-wrap items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-[var(--text-3)]">{label}</span>
          {recips.map((r) => (
            <span key={r.email} className={`tag-chip ${r.inCrm ? 'accent' : 'amber'}`} title={r.email}>
              {r.name ? `${r.name} ` : ''}{r.email}{!r.inCrm ? ' · Not in CRM' : ''}
              <button onClick={() => set(f)((prev) => prev.filter((x) => x.email !== r.email))}>✕</button>
            </span>
          ))}
          <input
            className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-[var(--text)] outline-none"
            value={q}
            onChange={(e) => setQueries((qq) => ({ ...qq, [f]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitFreeText(f) } }}
            onBlur={() => commitFreeText(f)}
            placeholder="name or email…"
          />
        </div>
        {matches.length > 0 ? (
          <div className="panel" style={{ position: 'absolute', zIndex: 60, left: 0, right: 0, top: 'calc(100% + 2px)', maxHeight: 200, overflowY: 'auto' }}>
            {matches.map((c) => (
              <button key={c.id} className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--surface-2)]" onClick={() => addRecipient(f, { email: c.email!, name: c.name, inCrm: true, accountId: c.account_id })}>
                <span className="text-sm text-[var(--text)]">{c.name}</span>
                <span className="text-[11px] text-[var(--text-3)]">{c.email}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  function withPending(recips: Recipient[], q: string): Recipient[] {
    const e = q.trim().toLowerCase()
    if (!e || !e.includes('@') || recips.some((r) => r.email.toLowerCase() === e)) return recips
    const c = byEmail.get(e)
    return [...recips, c ? { email: e, name: c.name, inCrm: true, accountId: c.account_id } : { email: e, inCrm: false }]
  }

  async function resolveAttachments(): Promise<PreAttachment[]> {
    const fileAttachments = await Promise.all(files.map(async (file) => ({
      filename: file.name, contentType: file.type || 'application/octet-stream', dataBase64: await readAsBase64(file),
    })))
    return [...preAttachments, ...fileAttachments]
  }
  function payloadFrom(L: { to: Recipient[]; cc: Recipient[]; bcc: Recipient[] }, attachments: PreAttachment[]): ComposePayload {
    return {
      to: L.to.map((r) => r.email).join(','),
      cc: L.cc.map((r) => r.email).join(','),
      bcc: L.bcc.map((r) => r.email).join(','),
      subject,
      body: bodyHtml + (signature ? `<br><br>${signature}` : ''),
      attachments,
      thread_id: threadId,
      in_reply_to: inReplyTo,
      account_id: accountId,
      draftId: draftIdRef.current,
    }
  }

  function doSendCheck() {
    const eff = { to: withPending(to, queries.to), cc: withPending(cc, queries.cc), bcc: withPending(bcc, queries.bcc) }
    setTo(eff.to); setCc(eff.cc); setBcc(eff.bcc); setQueries({ to: '', cc: '', bcc: '' })
    if (eff.to.length === 0) { setError('Add at least one recipient.'); return }
    const unknown = [...eff.to, ...eff.cc, ...eff.bcc].filter((r) => !r.inCrm)
    if (unknown.length > 0) {
      setAddList(unknown.map((r) => ({ email: r.email, add: true, name: '', account: '' })))
      return
    }
    void send(undefined, eff)
  }

  async function send(
    createRecipients?: Array<{ email: string; name?: string; account_id?: string | null; new_account_name?: string | null }>,
    lists?: { to: Recipient[]; cc: Recipient[]; bcc: Recipient[] }
  ) {
    const L = lists ?? { to, cc, bcc }
    setBusy(true); setError('')
    try {
      if (createRecipients && createRecipients.length > 0) {
        await apiFetch('/api/contacts/quick-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients: createRecipients }) })
      }
      const attachments = await resolveAttachments()
      const payload = payloadFrom(L, attachments)

      if (onSend) {
        // Undo-send path: hand the fully-resolved payload to the inbox, which
        // defers the actual API call and closes the modal now.
        onSend(payload)
        onClose()
        return
      }

      // Direct send (account/contact pages — no undo/draft machinery).
      await apiFetch('/api/gmail/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to, cc: payload.cc, bcc: payload.bcc, subject: payload.subject, body: payload.body,
          attachments: payload.attachments, reply_to_message_id: payload.thread_id, account_id: payload.account_id,
        }),
      })
      onSent(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
      setBusy(false); setAddList(null)
    }
  }

  async function schedule(sendAtIso: string) {
    const eff = { to: withPending(to, queries.to), cc: withPending(cc, queries.cc), bcc: withPending(bcc, queries.bcc) }
    setTo(eff.to); setCc(eff.cc); setBcc(eff.bcc); setQueries({ to: '', cc: '', bcc: '' })
    setScheduleOpen(false)
    if (eff.to.length === 0) { setError('Add at least one recipient.'); return }
    setBusy(true); setError('')
    try {
      const attachments = await resolveAttachments()
      onSchedule?.(payloadFrom(eff, attachments), sendAtIso)
      onSent(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
      setBusy(false)
    }
  }

  const tomorrow = nextTomorrow8()
  const monday = nextMonday8()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[8px] border border-[var(--border)] bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-5">
          {renderField('to', 'To')}
          <div className="flex gap-2">
            <div className="flex-1">{renderField('cc', 'Cc')}</div>
            {!showBcc ? <button className="btn btn-ghost btn-sm" onClick={() => setShowBcc(true)}>+ Bcc</button> : null}
          </div>
          {showBcc ? renderField('bcc', 'Bcc') : null}
          <input className={`${input} w-full`} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <RichTextEditor initialHTML={initialHtml} onChange={setBodyHtml} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn btn-ghost btn-sm cursor-pointer">📎 Attach<input type="file" multiple className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} /></label>
            {preAttachments.map((a, i) => (
              <span key={`pre-${i}`} className="tag-chip grey">📎 {a.filename}<button onClick={() => setPreAttachments((p) => p.filter((_, j) => j !== i))}>✕</button></span>
            ))}
            {files.map((file, i) => (
              <span key={i} className="tag-chip grey">{file.name}<button onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}>✕</button></span>
            ))}
          </div>
          {signature ? (
            <div className="rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-3)]">Signature (appended on send)</div>
              <div className="text-sm text-[var(--text-2)]" dangerouslySetInnerHTML={{ __html: signature }} />
            </div>
          ) : null}
          {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
          <span className="font-mono text-[11px] text-[var(--text-3)]">
            {draftsEnabled && draftSaved ? 'Draft saved' : 'Sends from your Workspace mailbox'}
          </span>
          <div className="relative flex items-center gap-1">
            <button className="btn btn-primary btn-sm" onClick={doSendCheck} disabled={busy}>{busy ? 'Working…' : '↗ Send'}</button>
            {onSchedule ? (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => setScheduleOpen((o) => !o)} disabled={busy} title="Schedule send">▾</button>
                {scheduleOpen ? (
                  <div className="panel" style={{ position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, zIndex: 70, minWidth: 220, padding: 6 }}>
                    <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => schedule(tomorrow.toISOString())}>
                      Send tomorrow 8am <span className="text-[11px] text-[var(--text-3)]">{labelFor(tomorrow)}</span>
                    </button>
                    <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => schedule(monday.toISOString())}>
                      Send Monday 8am <span className="text-[11px] text-[var(--text-3)]">{labelFor(monday)}</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <input type="datetime-local" className={input} value={pickTime} onChange={(e) => setPickTime(e.target.value)} />
                      <button className="btn btn-ghost btn-sm" disabled={!pickTime} onClick={() => { if (pickTime) schedule(new Date(pickTime).toISOString()) }}>Set</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {addList ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setAddList(null)}>
          <div className="w-full max-w-lg rounded-[8px] border border-[var(--border)] bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--text)]">These recipients aren’t in your CRM. Add them?</h3>
            <div className="mt-3 space-y-3">
              {addList.map((r, i) => (
                <div key={r.email} className="rounded-[5px] border border-[var(--border)] p-3">
                  <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                    <input type="checkbox" checked={r.add} onChange={(e) => setAddList((l) => l!.map((x, j) => j === i ? { ...x, add: e.target.checked } : x))} />
                    {r.email}
                  </label>
                  {r.add ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input className={input} placeholder="Name" value={r.name} onChange={(e) => setAddList((l) => l!.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                      <select className={input} value={r.account} onChange={(e) => setAddList((l) => l!.map((x, j) => j === i ? { ...x, account: e.target.value } : x))}>
                        <option value="">— account…</option>
                        {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                        <option value={`__new__${suggestAccountName(r.email)}`}>+ Create new account “{suggestAccountName(r.email)}”</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setAddList(null)} disabled={busy}>Cancel</button>
              <button className="btn btn-ghost btn-sm" onClick={() => send()} disabled={busy}>Send without adding</button>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => send(
                addList.filter((r) => r.add).map((r) => {
                  const isNew = r.account.startsWith('__new__')
                  return { email: r.email, name: r.name || undefined, account_id: isNew ? null : (r.account || null), new_account_name: isNew ? r.account.replace('__new__', '') : null }
                })
              )}>Send and add</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
