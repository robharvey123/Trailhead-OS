'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { CrmContact } from '@/lib/crm/types'

type AccountOption = { id: string; name: string }

export default function ContactsClient({
  workspaceId,
  initialContacts,
  accounts,
  brandNames = [],
}: {
  workspaceId: string
  initialContacts: CrmContact[]
  accounts: AccountOption[]
  brandNames?: string[]
}) {
  const [contacts, setContacts] = useState(initialContacts)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [filterBrand, setFilterBrand] = useState('all')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')
  const [brands, setBrands] = useState<string[]>([])

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))

  const resetForm = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone('')
    setJobTitle(''); setAccountId(''); setNotes(''); setBrands([]); setEditingId(null)
  }

  const openEdit = (c: CrmContact) => {
    setFirstName(c.first_name); setLastName(c.last_name)
    setEmail(c.email || ''); setPhone(c.phone || '')
    setJobTitle(c.job_title || ''); setAccountId(c.account_id || '')
    setNotes(c.notes || ''); setBrands(c.brands || []); setEditingId(c.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = {
      workspace_id: workspaceId, first_name: firstName, last_name: lastName,
      email: email || null, phone: phone || null, job_title: jobTitle || null,
      account_id: accountId || null, notes: notes || null, brands,
    }
    if (editingId) {
      const { contact } = await apiFetch<{ contact: CrmContact }>(
        `/api/crm/contacts/${editingId}?workspace_id=${workspaceId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      setContacts((prev) => prev.map((c) => (c.id === editingId ? contact : c)))
    } else {
      const { contact } = await apiFetch<{ contact: CrmContact }>('/api/crm/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setContacts((prev) => [...prev, contact])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Contact updated' : 'Contact created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, firstName, lastName, email, phone, jobTitle, accountId, notes, brands])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/crm/contacts/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast.success('Contact deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const toggleBrand = (b: string) => setBrands((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])

  const filtered = contacts.filter((c) => {
    if (filterAccount && c.account_id !== filterAccount) return false
    if (filterBrand !== 'all' && !c.brands?.includes(filterBrand)) return false
    if (search) {
      const q = search.toLowerCase()
      const full = `${c.first_name} ${c.last_name}`.toLowerCase()
      return full.includes(q) || c.email?.toLowerCase().includes(q) || c.job_title?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold">Contacts</h1>
          <p className="mt-1 text-sm text-slate-400">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">
          + New Contact
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {brandNames.length > 0 && (
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
            <option value="all">All brands</option>
            {brandNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <input type="text" placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500" />
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Contact' : 'New Contact'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">First Name *</label>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Last Name *</label>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
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
              <label className="mb-1 block text-xs text-slate-400">Job Title</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option value="">No account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            {brandNames.length > 0 && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Brands</label>
                <div className="flex flex-wrap gap-2">
                  {brandNames.map((b) => (
                    <label key={b} className="flex items-center gap-1.5 text-sm text-slate-300">
                      <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} className="rounded border-slate-600 bg-slate-950" />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Job Title</th>
              <th className="px-4 py-3">Account</th>
              {brandNames.length > 0 && <th className="px-4 py-3">Brands</th>}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={brandNames.length > 0 ? 7 : 6} className="px-4 py-8 text-center text-slate-500">No contacts found</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium"><Link href={`/workspace/${workspaceId}/contacts/${c.id}`} className="hover:text-blue-400 hover:underline">{c.first_name} {c.last_name}</Link></td>
                <td className="px-4 py-3 text-slate-400">{c.email || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{c.job_title || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{c.account_id ? <Link href={`/workspace/${workspaceId}/accounts`} className="hover:text-white hover:underline">{accountMap.get(c.account_id) || '—'}</Link> : '—'}</td>
                {brandNames.length > 0 && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.brands || []).map((b) => (
                        <span key={b} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{b}</span>
                      ))}
                    </div>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
