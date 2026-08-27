'use client'

import { useEffect, useMemo, useState } from 'react'
import EntityCombobox from './EntityCombobox'
import type { ImportPreview, ImportResult, ParticipantPlan } from '@/lib/whatsapp/import'

// Three steps: pick the file → map participants and file the conversation →
// confirm and report. The mapping screen is the point of the whole feature:
// importing thousands of messages against the wrong people, or silently
// splitting one person into two, is the main way this goes wrong.

const ME_KEY = 'whatsapp-import:me'
const TZ_KEY = 'whatsapp-import:tz'

type Mapping = {
  display_name: string
  contact_id: string
  contact_label: string
  contact_account_id: string | null
  is_self: boolean
  /** 'new' | participantId — for names not in the chosen existing conversation. */
  resolution: 'new' | string
}

type Props = {
  defaultAccountId: string | null
  defaultEngagementId: string | null
  defaultContactId: string | null
  onClose: () => void
  onImported: (result: ImportResult) => void
}

const fieldClass = 'w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)] focus:border-[color:var(--accent)] focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export default function WhatsAppImportModal({ defaultAccountId, defaultEngagementId, onClose, onImported }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [dateOrder, setDateOrder] = useState<'DMY' | 'MDY'>('DMY')
  const [timezone, setTimezone] = useState('Europe/London')
  const [numbering, setNumbering] = useState<'business' | 'personal'>('business')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [conversationId, setConversationId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [accountId, setAccountId] = useState(defaultAccountId ?? '')
  const [accountLabel, setAccountLabel] = useState('')
  const [engagementId, setEngagementId] = useState(defaultEngagementId ?? '')
  const [engagementLabel, setEngagementLabel] = useState('')
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [undone, setUndone] = useState(false)

  useEffect(() => {
    try {
      const tz = localStorage.getItem(TZ_KEY)
      if (tz) setTimezone(tz)
    } catch {
      /* ignore */
    }
  }, [])

  const selectedCandidate = useMemo(() => preview?.candidates.find((c) => c.id === conversationId) ?? null, [preview, conversationId])

  // Names that don't exist in the chosen conversation: must be resolved as new member or rename.
  const unresolved = useMemo(() => {
    if (!selectedCandidate) return []
    const existing = new Set(selectedCandidate.participants.map((p) => p.normalised_name))
    return mappings.filter((m) => !existing.has(m.display_name.toLowerCase()))
  }, [selectedCandidate, mappings])

  async function runPreview() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('mode', 'preview')
      fd.set('date_order', dateOrder)
      fd.set('timezone', timezone)
      fd.set('numbering', numbering)
      const res = await fetch('/api/whatsapp/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      const p = data as ImportPreview
      setPreview(p)
      try {
        localStorage.setItem(TZ_KEY, timezone)
      } catch {
        /* ignore */
      }
      let remembered = ''
      try {
        remembered = localStorage.getItem(ME_KEY) ?? ''
      } catch {
        /* ignore */
      }
      const first = p.candidates[0]
      const titleMatch = first?.title_match ? first : null
      setConversationId(titleMatch?.id ?? '')
      setTitle(p.title ?? (p.participants.length === 2 ? p.participants.find((x) => x.normalised_name !== remembered)?.display_name ?? '' : ''))
      setIsGroup(p.is_group)
      if (titleMatch?.account) {
        setAccountId(titleMatch.account.id)
        setAccountLabel(titleMatch.account.name)
      }
      if (titleMatch?.engagement) {
        setEngagementId(titleMatch.engagement.id)
        setEngagementLabel(titleMatch.engagement.code ?? titleMatch.engagement.name)
      }
      const existingSelf = titleMatch?.participants.find((x) => x.is_self)
      setMappings(
        p.participants.map((x) => {
          const existing = titleMatch?.participants.find((e) => e.normalised_name === x.normalised_name)
          return {
            display_name: x.display_name,
            contact_id: existing?.contact_id ?? x.suggested_contact?.id ?? '',
            contact_label: x.suggested_contact?.name ?? (existing?.contact_id ? '(linked)' : ''),
            contact_account_id: x.suggested_contact?.account_id ?? null,
            is_self: existing ? existing.is_self : existingSelf ? false : x.normalised_name === remembered,
            resolution: 'new',
          }
        })
      )
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  // Default the account from the mapped contacts if they agree; leave blank if they don't.
  useEffect(() => {
    if (accountId || !mappings.length) return
    const ids = Array.from(new Set(mappings.filter((m) => !m.is_self && m.contact_account_id).map((m) => m.contact_account_id as string)))
    if (ids.length === 1) setAccountId(ids[0])
  }, [mappings, accountId])

  function chooseConversation(id: string) {
    setConversationId(id)
    const c = preview?.candidates.find((x) => x.id === id) ?? null
    if (c) {
      setTitle(c.title)
      setIsGroup(c.is_group)
      if (c.account) {
        setAccountId(c.account.id)
        setAccountLabel(c.account.name)
      }
      if (c.engagement) {
        setEngagementId(c.engagement.id)
        setEngagementLabel(c.engagement.code ?? c.engagement.name)
      }
      setMappings((cur) =>
        cur.map((m) => {
          const existing = c.participants.find((e) => e.normalised_name === m.display_name.toLowerCase())
          return existing ? { ...m, is_self: existing.is_self, contact_id: existing.contact_id ?? m.contact_id, resolution: 'new' } : { ...m, resolution: 'new' }
        })
      )
    } else if (preview) {
      setTitle(preview.title ?? '')
      setIsGroup(preview.is_group)
    }
  }

  function updateMapping(i: number, patch: Partial<Mapping>) {
    setMappings((cur) => cur.map((m, idx) => (idx === i ? { ...m, ...patch } : patch.is_self ? { ...m, is_self: false } : m)))
  }

  async function commit() {
    if (!file || !preview) return
    const selfCount = mappings.filter((m) => m.is_self).length
    if (selfCount !== 1) {
      setError('Mark exactly one participant as you.')
      return
    }
    if (!conversationId && !title.trim()) {
      setError('Give the conversation a title.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const plan = {
        conversation_id: conversationId || null,
        title: title.trim(),
        is_group: isGroup,
        account_id: accountId || null,
        engagement_id: engagementId || null,
        participants: mappings.map<ParticipantPlan>((m) => ({
          display_name: m.display_name,
          contact_id: m.contact_id || null,
          is_self: m.is_self,
          merge_into_participant_id: m.resolution !== 'new' ? m.resolution : null,
        })),
      }
      const fd = new FormData()
      fd.set('file', file)
      fd.set('mode', 'commit')
      fd.set('date_order', dateOrder)
      fd.set('timezone', timezone)
      fd.set('numbering', numbering)
      fd.set('plan', JSON.stringify(plan))
      const res = await fetch('/api/whatsapp/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      const me = mappings.find((m) => m.is_self)
      try {
        if (me) localStorage.setItem(ME_KEY, me.display_name.toLowerCase())
      } catch {
        /* ignore */
      }
      setResult(data as ImportResult)
      setStep(3)
      onImported(data as ImportResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    if (!result) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/whatsapp/import?batch_id=${encodeURIComponent(result.batch_id)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Undo failed')
      setUndone(true)
      onImported(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--text)]">Import WhatsApp chat</h3>
            <p className="text-sm text-[color:var(--text-2)]">
              {step === 1 ? 'Step 1 of 3 — choose the export' : step === 2 ? 'Step 2 of 3 — map participants and file the conversation' : 'Step 3 of 3 — done'}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        {step === 1 ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>Export file (.txt, .zip or .json)</label>
              <input type="file" accept=".txt,.zip,.json,text/plain,application/zip,application/json" className={fieldClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="mt-1 text-xs text-[color:var(--text-3)]">iPhone: chat → name → Export Chat → Without Media. Android: ⋮ → More → Export chat → Without media. Max 4 MB.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Date order fallback</label>
                <select className={fieldClass} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'DMY' | 'MDY')}>
                  <option value="DMY">Day / Month / Year</option>
                  <option value="MDY">Month / Day / Year</option>
                </select>
                <p className="mt-1 text-xs text-[color:var(--text-3)]">Only used if the file has no unambiguous date.</p>
              </div>
              <div>
                <label className={labelClass}>Phone timezone</label>
                <input className={fieldClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/London" />
              </div>
              <div>
                <label className={labelClass}>Number</label>
                <select className={fieldClass} value={numbering} onChange={(e) => setNumbering(e.target.value as 'business' | 'personal')}>
                  <option value="business">Business</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={() => void runPreview()}>
                {busy ? 'Reading…' : 'Preview'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 && preview ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-[color:var(--text-3)]">Detected</p>
                <p className="font-medium text-[color:var(--text)]">{preview.title ?? 'Untitled chat'}</p>
                <p className="text-xs text-[color:var(--text-2)]">{preview.is_group ? 'Group' : '1:1'}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--text-3)]">Messages</p>
                <p className="font-medium text-[color:var(--text)]">{preview.count}</p>
                {preview.skipped_lines ? <p className="text-xs text-[color:var(--amber-strong)]">{preview.skipped_lines} unrecognised lines skipped</p> : null}
              </div>
              <div>
                <p className="text-xs text-[color:var(--text-3)]">From</p>
                <p className="text-[color:var(--text)]">{fmt(preview.first_at)}</p>
              </div>
              <div>
                <p className="text-xs text-[color:var(--text-3)]">To</p>
                <p className="text-[color:var(--text)]">{fmt(preview.last_at)}</p>
                <p className="text-xs text-[color:var(--text-2)]">Dates read as {preview.detected_date_order === 'ambiguous' ? `${dateOrder} (assumed)` : preview.detected_date_order}</p>
              </div>
            </div>

            <div>
              <label className={labelClass}>Conversation</label>
              <select className={fieldClass} value={conversationId} onChange={(e) => chooseConversation(e.target.value)}>
                <option value="">Create new conversation</option>
                {preview.candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    Add to existing: {c.title} — {c.participants.length} participants, {c.message_count} messages{c.title_match ? ' (title match)' : ` (${c.overlap} shared names)`}
                  </option>
                ))}
              </select>
              {preview.candidates.length > 0 && !conversationId ? (
                <p className="mt-1 text-xs text-[color:var(--amber-strong)]">A conversation with overlapping people already exists. Group names get reused, so check before merging.</p>
              ) : null}
            </div>

            {!conversationId ? (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className={labelClass}>Title</label>
                  <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. QOLA UK development, or the contact's name" />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-[color:var(--text)]">
                  <input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} /> Group chat
                </label>
              </div>
            ) : null}

            <div>
              <p className={labelClass}>Participants — map to CRM, mark yourself, leave unmapped if there is no contact yet</p>
              <div className="space-y-2">
                {mappings.map((m, i) => {
                  const pv = preview.participants[i]
                  const needsResolution = selectedCandidate ? unresolved.some((u) => u.display_name === m.display_name) : false
                  return (
                    <div key={m.display_name} className={`grid gap-2 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] ${needsResolution ? 'border-[color:var(--amber-strong)]' : 'border-[var(--border)]'}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[color:var(--text)]">{m.display_name}</p>
                        <p className="text-xs text-[color:var(--text-3)]">
                          {pv?.message_count ?? 0} messages{pv?.joined_at ? ` · joined ${new Date(pv.joined_at).toLocaleDateString('en-GB')}` : ''}
                          {pv?.left_at ? ` · left ${new Date(pv.left_at).toLocaleDateString('en-GB')}` : ''}
                        </p>
                        {needsResolution && selectedCandidate ? (
                          <div className="mt-2">
                            <label className={labelClass}>Not in this conversation yet</label>
                            <select className={fieldClass} value={m.resolution} onChange={(e) => updateMapping(i, { resolution: e.target.value })}>
                              <option value="new">New member</option>
                              {selectedCandidate.participants
                                .filter((p) => !mappings.some((x) => x.display_name.toLowerCase() === p.normalised_name))
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    Same person as “{p.display_name}” (renamed)
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                      <div className={m.is_self ? 'opacity-40' : ''}>
                        <EntityCombobox
                          label="CRM contact"
                          entity="contact"
                          value={m.contact_id}
                          selectedLabel={m.contact_label}
                          clearable
                          disabled={m.is_self}
                          placeholder="Leave unmapped"
                          onChange={(opt) => updateMapping(i, { contact_id: opt.id, contact_label: opt.label, contact_account_id: null })}
                        />
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm text-[color:var(--text)]">
                        <input type="radio" name="me" checked={m.is_self} onChange={() => updateMapping(i, { is_self: true, contact_id: '', contact_label: '' })} /> me
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <EntityCombobox label="Account" entity="account" value={accountId} selectedLabel={accountLabel} clearable allowCreate={false} onChange={(o) => { setAccountId(o.id); setAccountLabel(o.label) }} />
              <EntityCombobox label="Engagement" entity="engagement" value={engagementId} selectedLabel={engagementLabel} clearable onChange={(o) => { setEngagementId(o.id); setEngagementLabel(o.label) }} />
            </div>

            <div>
              <p className={labelClass}>Sample — first {preview.sample.length} messages</p>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
                {preview.sample.map((s, i) => (
                  <p key={i} className="text-[color:var(--text)]">
                    <span className="text-[color:var(--text-3)]">{s.occurred_at_local.replace('T', ' ')}</span> <span className="font-medium">{s.sender ?? 'system'}:</span>{' '}
                    <span className={s.type === 'media' ? 'italic text-[color:var(--text-2)]' : ''}>{s.body.length > 160 ? `${s.body.slice(0, 160)}…` : s.body}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn btn-sm" onClick={() => setStep(1)} disabled={busy}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void commit()} disabled={busy}>
                {busy ? 'Importing…' : conversationId ? 'Import into conversation' : 'Create and import'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 && result ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
              {undone ? (
                <p className="text-[color:var(--text)]">Import undone. {result.imported} messages removed.</p>
              ) : (
                <>
                  <p className="font-medium text-[color:var(--text)]">
                    {result.imported} imported · {result.skipped} already present{result.edited > 0 ? ` · ${result.edited} edited` : ''}
                  </p>
                  {result.edited > 0 ? (
                    <p className="mt-1 text-[color:var(--amber-strong)]">
                      {result.edited} stored message{result.edited === 1 ? ' was' : 's were'} replaced with the edited text from the export.
                    </p>
                  ) : null}
                  {result.superseded > 0 ? (
                    <p className="mt-1 text-[color:var(--text-2)]">
                      {result.superseded} live-captured row{result.superseded === 1 ? '' : 's'} replaced by the export — the phone is ground truth for that window.
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[color:var(--text-3)]">Batch {result.batch_id}</p>
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              {!undone && result.imported > 0 ? (
                <button type="button" className="text-sm text-[color:var(--red-strong)] hover:underline" onClick={() => void undo()} disabled={busy}>
                  Undo this import
                </button>
              ) : <span />}
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}
      </div>
    </div>
  )
}
