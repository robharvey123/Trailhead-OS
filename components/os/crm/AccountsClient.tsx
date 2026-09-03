'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import type { AccountStatus, SavedView, Tag } from '@/lib/types'
import type { AccountListItem } from '@/lib/db/accounts'

const STATUS_ORDER: AccountStatus[] = [
  'prospect',
  'contacted',
  'active',
  'listed',
  'declined',
  'on_hold',
]

const STATUS_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  active: 'Active',
  listed: 'Listed',
  declined: 'Declined',
  on_hold: 'On Hold',
  inactive: 'Inactive',
  archived: 'Archived',
}

interface AccountsClientProps {
  initialAccounts: AccountListItem[]
  allTags: Tag[]
  accountTags: Record<string, Tag[]>
  channels: string[]
  savedViews: SavedView[]
  defaultTermsDays?: number
}

interface Filters {
  search: string
  channel: string
  status: string
  tag: string
  /** '' all · 'custom' has own payment terms · 'default' inherits the company default */
  terms: string
  /** '' none · 'terms_asc' · 'terms_desc' — saved with views like the filters */
  sort: string
}

const EMPTY_FILTERS: Filters = { search: '', channel: '', status: '', tag: '', terms: '', sort: '' }

export default function AccountsClient({
  initialAccounts,
  allTags,
  accountTags,
  channels,
  savedViews: initialViews,
  defaultTermsDays = 14,
}: AccountsClientProps) {
  const router = useRouter()
  const [accounts] = useState(initialAccounts)
  const [tagMap, setTagMap] = useState(accountTags)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [views, setViews] = useState<SavedView[]>(initialViews)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }))

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const rows = accounts.filter((a) => {
      if (filters.status && a.status !== filters.status) return false
      if (filters.channel && a.channel !== filters.channel) return false
      if (filters.tag && !(tagMap[a.id] ?? []).some((t) => t.id === filters.tag)) return false
      if (filters.terms === 'custom' && a.payment_terms_days == null) return false
      if (filters.terms === 'default' && a.payment_terms_days != null) return false
      if (q) {
        const hay = `${a.name} ${a.website ?? ''} ${a.channel ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (filters.sort === 'terms_asc' || filters.sort === 'terms_desc') {
      const dir = filters.sort === 'terms_asc' ? 1 : -1
      rows.sort((a, b) => ((a.payment_terms_days ?? defaultTermsDays) - (b.payment_terms_days ?? defaultTermsDays)) * dir || a.name.localeCompare(b.name))
    }
    return rows
  }, [accounts, filters, tagMap, defaultTermsDays])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of accounts) counts[a.status] = (counts[a.status] ?? 0) + 1
    return counts
  }, [accounts])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id))
    )
  }

  async function bulk(action: 'tag' | 'status' | 'terms' | 'delete', payload?: Record<string, unknown>) {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (action === 'delete' && !confirm(`Delete ${ids.length} account(s)? This cannot be undone.`))
      return
    setBusy(true)
    setError('')
    try {
      await apiFetch('/api/accounts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, ...payload }),
      })
      if (action === 'tag' && payload?.tag_id) {
        const tag = allTags.find((t) => t.id === payload.tag_id)
        if (tag) {
          setTagMap((prev) => {
            const next = { ...prev }
            for (const id of ids) {
              const existing = next[id] ?? []
              if (!existing.some((t) => t.id === tag.id)) next[id] = [...existing, tag]
            }
            return next
          })
        }
        setSelected(new Set())
        setBusy(false)
        return
      }
      // status/delete change the rows — refresh from server
      router.refresh()
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed')
    } finally {
      setBusy(false)
    }
  }

  function setBulkTerms() {
    const raw = prompt('Payment terms in days for the selected accounts (leave empty to clear back to the company default):')
    if (raw === null) return
    const trimmed = raw.trim()
    if (trimmed !== '' && (!/^\d+$/.test(trimmed) || Number(trimmed) > 365)) {
      setError('Payment terms must be a whole number of days between 0 and 365, or empty to clear.')
      return
    }
    void bulk('terms', { payment_terms_days: trimmed === '' ? null : Number(trimmed) })
  }

  function cycleTermsSort() {
    setFilters((f) => ({ ...f, sort: f.sort === 'terms_asc' ? 'terms_desc' : f.sort === 'terms_desc' ? '' : 'terms_asc' }))
  }

  function exportCsv() {
    const rows = (selected.size ? filtered.filter((a) => selected.has(a.id)) : filtered).map((a) => ({
      Name: a.name,
      Channel: a.channel ?? '',
      Status: STATUS_LABEL[a.status] ?? a.status,
      Terms: a.payment_terms_days != null ? `${a.payment_terms_days}d` : `${defaultTermsDays}d default`,
      Website: a.website ?? '',
      Contacts: a.contacts_count ?? 0,
      Tags: (tagMap[a.id] ?? []).map((t) => t.name).join('; '),
    }))
    const headers = Object.keys(rows[0] ?? { Name: '' })
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'accounts.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function saveCurrentView() {
    const name = prompt('Name this view:')
    if (!name?.trim()) return
    try {
      const { view } = await apiFetch<{ view: SavedView }>('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: 'accounts', name: name.trim(), filters }),
      })
      setViews((v) => [...v, view])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save view')
    }
  }

  function applyView(view: SavedView) {
    setFilters({ ...EMPTY_FILTERS, ...(view.filters as Partial<Filters>) })
    setViewsOpen(false)
  }

  async function togglePin(view: SavedView) {
    try {
      const { view: updated } = await apiFetch<{ view: SavedView }>(`/api/saved-views/${view.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !view.is_pinned }),
      })
      setViews((vs) => vs.map((v) => (v.id === view.id ? updated : v)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pin view')
    }
  }

  async function removeView(view: SavedView) {
    try {
      await apiFetch(`/api/saved-views/${view.id}`, { method: 'DELETE' })
      setViews((vs) => vs.filter((v) => v.id !== view.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete view')
    }
  }

  const allChecked = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="panel overflow-hidden">
      {/* topbar */}
      <div className="topbar">
        <span className="topbar-title">CRM</span>
        <span className="topbar-count">{accounts.length} accounts</span>
        <div className="topbar-actions">
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setViewsOpen((o) => !o)}>
              ◷ Saved views
            </button>
            {viewsOpen ? (
              <div
                className="panel"
                style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 280, zIndex: 50, padding: 8 }}
              >
                {views.length === 0 ? (
                  <p className="field-label" style={{ padding: 8 }}>No saved views yet.</p>
                ) : (
                  views.map((v) => (
                    <div
                      key={v.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px' }}
                    >
                      <button
                        className="td-name"
                        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                        onClick={() => applyView(v)}
                      >
                        {v.is_pinned ? '📌 ' : ''}
                        {v.name}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => togglePin(v)}>
                        {v.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => removeView(v)}>
                        ✕
                      </button>
                    </div>
                  ))
                )}
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 6 }} onClick={saveCurrentView}>
                  + Save current view
                </button>
              </div>
            ) : null}
          </div>
          <Link className="btn btn-primary btn-sm" href="/crm/accounts/new">
            + Add account
          </Link>
        </div>
      </div>

      {/* stats */}
      <div className="stats-bar">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            className="stat-item"
            style={{ background: filters.status === s ? 'var(--surface-2)' : undefined, cursor: 'pointer', textAlign: 'left', border: 'none', borderRight: '1px solid var(--border)' }}
            onClick={() => setFilter('status', filters.status === s ? '' : s)}
          >
            <div className="stat-label">{STATUS_LABEL[s]}</div>
            <div className="stat-value">{statusCounts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* filter bar */}
      <div className="filterbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            placeholder="Search accounts..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </div>
        <select className="filter-select" value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)}>
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="filter-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className="filter-select" value={filters.tag} onChange={(e) => setFilter('tag', e.target.value)}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select className="filter-select" value={filters.terms} onChange={(e) => setFilter('terms', e.target.value)}>
          <option value="">All terms</option>
          <option value="custom">Own terms</option>
          <option value="default">Inheriting default</option>
        </select>
        {(filters.search || filters.channel || filters.status || filters.tag || filters.terms || filters.sort) ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
        ) : null}
      </div>

      {/* bulk action bar */}
      {selected.size > 0 ? (
        <div className="bulkbar">
          <span className="bulk-count">{selected.size} selected</span>
          <select
            className="filter-select"
            defaultValue=""
            onChange={(e) => { if (e.target.value) { bulk('tag', { tag_id: e.target.value }); e.target.value = '' } }}
          >
            <option value="">Tag…</option>
            {allTags.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <select
            className="filter-select"
            defaultValue=""
            onChange={(e) => { if (e.target.value) { bulk('status', { status: e.target.value }); e.target.value = '' } }}
          >
            <option value="">Change status…</option>
            {STATUS_ORDER.map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={setBulkTerms} disabled={busy}>Set payment terms</button>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={busy}>Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => bulk('delete')} disabled={busy} style={{ color: 'var(--red)' }}>Delete</button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      ) : null}

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '8px 24px' }}>{error}</p> : null}

      {/* table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th>Account</th>
              <th>Channel</th>
              <th>Status</th>
              <th>
                <button
                  type="button"
                  onClick={cycleTermsSort}
                  title="Payment terms — click to sort"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit', padding: 0 }}
                >
                  Terms{filters.sort === 'terms_asc' ? ' ▲' : filters.sort === 'terms_desc' ? ' ▼' : ''}
                </button>
              </th>
              <th>Tags</th>
              <th>Website</th>
              <th>Key contact</th>
              <th style={{ textAlign: 'right' }}>Contacts</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="empty">No accounts match this view.</td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className={selected.has(a.id) ? 'selected' : ''}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.name}`} />
                  </td>
                  <td onClick={() => router.push(`/crm/accounts/${a.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="td-name">{a.name}</div>
                    {a.city || a.postcode ? (
                      <div className="td-sub">{[a.city, a.postcode].filter(Boolean).join(' ')}</div>
                    ) : null}
                  </td>
                  <td>{a.channel ? <span className="channel-tag">{a.channel}</span> : <span className="td-mono">—</span>}</td>
                  <td><span className={`status-badge status-${a.status}`}>{STATUS_LABEL[a.status] ?? a.status}</span></td>
                  <td className="td-mono">
                    {a.payment_terms_days != null ? (
                      `${a.payment_terms_days}d`
                    ) : (
                      <span style={{ color: 'var(--muted, #94a3b8)' }}>{defaultTermsDays}d default</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(tagMap[a.id] ?? []).map((t) => (
                        <span key={t.id} className={`tag-chip ${t.color}`}>{t.name}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {a.website ? (
                      <a className="website-link" href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {a.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    ) : <span className="td-mono">—</span>}
                  </td>
                  <td className="td-mono">{a.contacts && a.contacts.length > 0 ? a.contacts[0].name : '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{a.contacts_count ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
