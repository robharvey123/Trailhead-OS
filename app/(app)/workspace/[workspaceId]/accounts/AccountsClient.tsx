'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { currencySymbol } from '@/lib/format'
import type { CrmAccount, CrmAccountType } from '@/lib/crm/types'
import { CRM_ACCOUNT_TYPES, CRM_ACCOUNT_TYPE_LABELS } from '@/lib/crm/types'

export default function AccountsClient({
  workspaceId,
  initialAccounts,
  stats,
  baseCurrency,
}: {
  workspaceId: string
  initialAccounts: CrmAccount[]
  stats: Record<string, { contacts: number; deals: number; pipeline: number }>
  baseCurrency: string
}) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Form state
  const [name, setName] = useState('')
  const [type, setType] = useState<CrmAccountType>('customer')
  const [industry, setIndustry] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setName('')
    setType('customer')
    setIndustry('')
    setEmail('')
    setPhone('')
    setWebsite('')
    setCity('')
    setCountry('')
    setNotes('')
    setEditingId(null)
  }

  const openEdit = (a: CrmAccount) => {
    setName(a.name)
    setType(a.type)
    setIndustry(a.industry || '')
    setEmail(a.email || '')
    setPhone(a.phone || '')
    setWebsite(a.website || '')
    setCity(a.city || '')
    setCountry(a.country || '')
    setNotes(a.notes || '')
    setEditingId(a.id)
    setShowForm(true)
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSaving(true)
      try {
      const payload = {
        workspace_id: workspaceId,
        name,
        type,
        industry: industry || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        city: city || null,
        country: country || null,
        notes: notes || null,
      }

      if (editingId) {
        const { account } = await apiFetch<{ account: CrmAccount }>(
          `/api/crm/accounts/${editingId}?workspace_id=${workspaceId}`,
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        )
        setAccounts((prev) => prev.map((a) => (a.id === editingId ? account : a)))
      } else {
        const { account } = await apiFetch<{ account: CrmAccount }>('/api/crm/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        setAccounts((prev) => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
      }

      resetForm()
      setShowForm(false)
      toast.success(editingId ? 'Account updated' : 'Account created')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setSaving(false)
      }
    },
    [workspaceId, editingId, name, type, industry, email, phone, website, city, country, notes]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/crm/accounts/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
        setAccounts((prev) => prev.filter((a) => a.id !== id))
        toast.success('Account deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [workspaceId]
  )

  const filtered = accounts.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.industry?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold">Accounts</h1>
          <p className="mt-1 text-sm text-slate-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-white"
        >
          + New Account
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All types</option>
          {CRM_ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{CRM_ACCOUNT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Account' : 'New Account'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CrmAccountType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {CRM_ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{CRM_ACCOUNT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Industry</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Relationships</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No accounts found</td></tr>
            ) : (
              filtered.map((a) => {
                const s = stats[a.id] || { contacts: 0, deals: 0, pipeline: 0 }
                return (
                <tr key={a.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/workspace/${workspaceId}/accounts/${a.id}`} className="hover:text-blue-400 transition">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs">
                      {CRM_ACCOUNT_TYPE_LABELS[a.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.industry || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {s.contacts > 0 || s.deals > 0 ? (
                      <span>
                        {s.contacts} contact{s.contacts !== 1 ? 's' : ''}
                        {' · '}
                        {s.deals} deal{s.deals !== 1 ? 's' : ''}
                        {s.pipeline > 0 && ` · ${currencySymbol(baseCurrency)}${(s.pipeline / 1000).toFixed(0)}k`}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{a.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{a.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(a)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
