'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Contact, ContactStatus } from '@/lib/types'

type Named = { id: string; name: string }

const STATUS_TABS: Array<{ value: ContactStatus; label: string }> = [
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_LABEL: Record<string, string> = {
  lead: 'Lead', active: 'Active', inactive: 'Inactive', archived: 'Archived',
}
// map contact status -> .thmock status-badge class
const STATUS_CLASS: Record<string, string> = {
  lead: 'status-prospect', active: 'status-active', inactive: 'status-inactive', archived: 'status-archived',
}

interface ContactsClientProps {
  contacts: Contact[]
  accounts: Named[]
  channels: string[]
}

export default function ContactsClient({ contacts, accounts, channels }: ContactsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [accountId, setAccountId] = useState('')
  const [channel, setChannel] = useState('')

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (status && c.status !== status) return false
      if (accountId && c.account_id !== accountId) return false
      if (channel && c.channel !== channel) return false
      if (q) {
        const hay = `${c.name} ${c.email ?? ''} ${c.company ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [contacts, search, status, accountId, channel])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of contacts) counts[c.status] = (counts[c.status] ?? 0) + 1
    return counts
  }, [contacts])

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <Link href="/crm/accounts" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Accounts</Link>
        <span className="topbar-title">Contacts</span>
        <span className="topbar-count">{contacts.length} contacts</span>
        <div className="topbar-actions">
          <Link className="btn btn-ghost btn-sm" href="/crm/contacts/import">↑ Import</Link>
          <Link className="btn btn-primary btn-sm" href="/crm/contacts/new">+ Add contact</Link>
        </div>
      </div>

      <div className="stats-bar">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            className="stat-item"
            style={{ background: status === t.value ? 'var(--surface-2)' : undefined, cursor: 'pointer', textAlign: 'left', border: 'none', borderRight: '1px solid var(--border)' }}
            onClick={() => setStatus(status === t.value ? '' : t.value)}
          >
            <div className="stat-label">{t.label}</div>
            <div className="stat-value">{statusCounts[t.value] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="filterbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search-input" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <select className="filter-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">All channels</option>
          {channels.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_TABS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
        {(search || status || accountId || channel) ? (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus(''); setAccountId(''); setChannel('') }}>Clear</button>
        ) : null}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Contact</th><th>Account</th><th>Role</th><th>Email</th><th>Channel</th><th>Status</th><th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="empty">No contacts match this view.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/crm/contacts/${c.id}`)}>
                  <td>
                    <div className="td-name">{c.name}</div>
                    {c.company ? <div className="td-sub">{c.company}</div> : null}
                  </td>
                  <td className="td-mono">{c.account_id ? accountName.get(c.account_id) ?? '—' : '—'}</td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{c.role ?? '—'}</td>
                  <td>
                    {c.email ? (
                      <a className="website-link" href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>{c.email}</a>
                    ) : <span className="td-mono">—</span>}
                  </td>
                  <td>{c.channel ? <span className="channel-tag">{c.channel}</span> : <span className="td-mono">—</span>}</td>
                  <td><span className={`status-badge ${STATUS_CLASS[c.status] ?? 'status-on_hold'}`}>{STATUS_LABEL[c.status] ?? c.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(c.tags ?? []).map((t) => (<span key={t} className="channel-tag">{t}</span>))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
