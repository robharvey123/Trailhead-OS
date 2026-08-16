'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-fetch'
import MergeDialog, { type MergeRequest } from './MergeDialog'

type Suggestion = { account: { id: string; name: string }; score: number; reason: 'exact' | 'normalised' | 'domain' | 'fuzzy' }
type UnlinkedRow = { contact: { id: string; name: string; company: string | null; email: string | null }; suggestions: Suggestion[] }
type AccountDup = { a: { id: string; name: string }; b: { id: string; name: string }; score: number }
type ContactDup = { a: { id: string; name: string; company: string | null }; b: { id: string; name: string; company: string | null }; reason: 'name' | 'email' }
type ThreadRow = { gmail_thread_id: string; subject: string | null; from_address: string | null; suggestion: { id: string; name: string } | null }

interface Data {
  unlinked_contacts: UnlinkedRow[]
  account_duplicates: AccountDup[]
  contact_duplicates: ContactDup[]
  unmatched_threads: ThreadRow[]
  placeholders_count: number
}

const REASON_LABEL: Record<Suggestion['reason'], string> = { exact: 'exact', normalised: 'name', domain: 'domain', fuzzy: 'fuzzy' }
const pct = (s: number) => `${Math.round(s * 100)}%`

type Tab = 'contacts' | 'accounts' | 'contact-dupes' | 'threads'

export default function LinkBacklogClient() {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<Tab>('contacts')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [merge, setMerge] = useState<MergeRequest | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Data>('/api/crm/suggestions'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suggestions')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n })

  async function linkContact(contactId: string, accountId: string) {
    await apiFetch(`/api/contacts/${contactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_id: accountId }) })
    setData((d) => d ? { ...d, unlinked_contacts: d.unlinked_contacts.filter((r) => r.contact.id !== contactId) } : d)
  }

  async function accept(row: UnlinkedRow, sugg: Suggestion) {
    mark(row.contact.id, true)
    setError('')
    try { await linkContact(row.contact.id, sugg.account.id) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to link') }
    finally { mark(row.contact.id, false) }
  }

  async function createAndLink(row: UnlinkedRow) {
    const name = (row.contact.company || row.contact.name).trim()
    if (!name) return
    mark(row.contact.id, true)
    setError('')
    try {
      const { account } = await apiFetch<{ account: { id: string } }>('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      await linkContact(row.contact.id, account.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create account') }
    finally { mark(row.contact.id, false) }
  }

  async function skip(row: UnlinkedRow) {
    mark(row.contact.id, true)
    try {
      await apiFetch('/api/crm/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: row.contact.id, action: 'skip' }) })
      setData((d) => d ? { ...d, unlinked_contacts: d.unlinked_contacts.filter((r) => r.contact.id !== row.contact.id) } : d)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to skip') }
    finally { mark(row.contact.id, false) }
  }

  async function acceptAllHighConfidence() {
    if (!data) return
    const targets = data.unlinked_contacts.filter((r) => (r.suggestions[0]?.score ?? 0) >= 0.9)
    for (const r of targets) {
      // eslint-disable-next-line no-await-in-loop
      await accept(r, r.suggestions[0])
    }
  }

  function onMerged(loserId: string) {
    setData((d) => d ? {
      ...d,
      account_duplicates: d.account_duplicates.filter((p) => p.a.id !== loserId && p.b.id !== loserId),
      contact_duplicates: d.contact_duplicates.filter((p) => p.a.id !== loserId && p.b.id !== loserId),
      unlinked_contacts: d.unlinked_contacts.filter((r) => r.contact.id !== loserId),
    } : d)
    setMerge(null)
  }

  if (error && !data) return <div className="os-card p-6"><p className="text-sm text-[color:var(--red-strong)]">{error}</p></div>
  if (!data) return <div className="os-card p-6"><p className="text-sm text-[color:var(--text-2)]">Loading…</p></div>

  const highConf = data.unlinked_contacts.filter((r) => (r.suggestions[0]?.score ?? 0) >= 0.9).length

  return (
    <div className="thmock space-y-4">
      <div>
        <Link href="/crm/contacts" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Contacts</Link>
        <h1 className="os-page-title mt-2">Linking backlog</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Suggestions only — nothing is applied automatically. {data.placeholders_count > 0 ? `${data.placeholders_count} placeholder contacts (name = company) are handled by the cleanup script, not here.` : ''}
        </p>
      </div>

      {error ? <div className="os-card p-3 text-sm text-[color:var(--red-strong)]">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <button className={`btn btn-ghost btn-sm ${tab === 'contacts' ? 'active' : ''}`} onClick={() => setTab('contacts')}>Unlinked contacts ({data.unlinked_contacts.length})</button>
        <button className={`btn btn-ghost btn-sm ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>Duplicate accounts ({data.account_duplicates.length})</button>
        <button className={`btn btn-ghost btn-sm ${tab === 'contact-dupes' ? 'active' : ''}`} onClick={() => setTab('contact-dupes')}>Duplicate contacts ({data.contact_duplicates.length})</button>
        <button className={`btn btn-ghost btn-sm ${tab === 'threads' ? 'active' : ''}`} onClick={() => setTab('threads')}>Unmatched threads ({data.unmatched_threads.length})</button>
      </div>

      {tab === 'contacts' ? (
        <div className="os-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-[color:var(--text-2)]">{data.unlinked_contacts.length} unlinked</p>
            <button className="btn btn-primary btn-sm" disabled={highConf === 0} onClick={() => void acceptAllHighConfidence()}>Accept all ≥ 90% ({highConf})</button>
          </div>
          {data.unlinked_contacts.length === 0 ? (
            <div className="empty">Nothing left to link.</div>
          ) : (
            <div className="space-y-2">
              {data.unlinked_contacts.map((row) => {
                const top = row.suggestions[0]
                const working = busy.has(row.contact.id)
                return (
                  <div key={row.contact.id} className="card flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[color:var(--text)]">{row.contact.name}</div>
                      <div className="td-mono text-xs" style={{ color: 'var(--text-3)' }}>{[row.contact.company, row.contact.email].filter(Boolean).join(' · ') || 'no company / email'}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {top ? (
                        <span className="meta-chip" title={`match: ${REASON_LABEL[top.reason]}`}>{top.account.name} · {pct(top.score)}</span>
                      ) : (
                        <span className="td-mono text-xs" style={{ color: 'var(--text-3)' }}>no suggestion</span>
                      )}
                      {top ? <button className="btn btn-primary btn-sm" disabled={working} onClick={() => void accept(row, top)}>Accept</button> : null}
                      {row.suggestions.slice(1).map((s) => (
                        <button key={s.account.id} className="btn btn-ghost btn-sm" disabled={working} onClick={() => void accept(row, s)} title={`${REASON_LABEL[s.reason]} ${pct(s.score)}`}>{s.account.name}</button>
                      ))}
                      <button className="btn btn-ghost btn-sm" disabled={working} onClick={() => void createAndLink(row)}>Create account</button>
                      <button className="btn btn-ghost btn-sm" disabled={working} onClick={() => void skip(row)}>Skip</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'accounts' ? (
        <div className="os-card p-4">
          <p className="mb-3 text-sm text-[color:var(--text-2)]">Near-duplicate account names. Merge keeps one and repoints everything pointing at the other.</p>
          {data.account_duplicates.length === 0 ? <div className="empty">No duplicate accounts detected.</div> : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Account A</th><th>Account B</th><th style={{ textAlign: 'right' }}>Similarity</th><th></th></tr></thead>
              <tbody>
                {data.account_duplicates.map((d) => (
                  <tr key={`${d.a.id}:${d.b.id}`}>
                    <td className="td-name"><Link href={`/crm/accounts/${d.a.id}`}>{d.a.name}</Link></td>
                    <td className="td-name"><Link href={`/crm/accounts/${d.b.id}`}>{d.b.name}</Link></td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{pct(d.score)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setMerge({ type: 'account', a: d.a, b: d.b })}>Merge…</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'contact-dupes' ? (
        <div className="os-card p-4">
          <p className="mb-3 text-sm text-[color:var(--text-2)]">Contacts sharing a name or email. Merge keeps one and moves history across. Contacts in a running campaign are blocked until it stops.</p>
          {data.contact_duplicates.length === 0 ? <div className="empty">No duplicate contacts detected.</div> : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Contact A</th><th>Contact B</th><th>Match</th><th></th></tr></thead>
              <tbody>
                {data.contact_duplicates.map((d) => (
                  <tr key={`${d.a.id}:${d.b.id}`}>
                    <td className="td-name"><Link href={`/crm/contacts/${d.a.id}`}>{d.a.name}</Link>{d.a.company ? <div className="td-sub">{d.a.company}</div> : null}</td>
                    <td className="td-name"><Link href={`/crm/contacts/${d.b.id}`}>{d.b.name}</Link>{d.b.company ? <div className="td-sub">{d.b.company}</div> : null}</td>
                    <td><span className="channel-tag">{d.reason}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setMerge({ type: 'contact', a: d.a, b: d.b })}>Merge…</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'threads' ? (
        <div className="os-card p-4">
          <p className="mb-3 text-sm text-[color:var(--text-2)]">Inbox threads with no account. Link them from the inbox reader.</p>
          {data.unmatched_threads.length === 0 ? <div className="empty">No unmatched threads.</div> : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>From</th><th>Subject</th><th>Suggested account</th></tr></thead>
              <tbody>
                {data.unmatched_threads.map((t) => (
                  <tr key={t.gmail_thread_id}>
                    <td className="td-mono text-xs">{t.from_address ?? '—'}</td>
                    <td>{t.subject ?? '—'}</td>
                    <td>{t.suggestion ? <span className="meta-chip">{t.suggestion.name}</span> : <span className="td-mono text-xs" style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      ) : null}

      {merge ? <MergeDialog request={merge} onClose={() => setMerge(null)} onMerged={onMerged} /> : null}
    </div>
  )
}
