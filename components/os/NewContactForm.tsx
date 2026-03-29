'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import SearchSelect from './SearchSelect'
import type { Account, Contact, ContactStatus, Workstream } from '@/lib/types'

const CONTACT_STATUSES: ContactStatus[] = ['lead', 'active', 'inactive', 'archived']

export default function NewContactForm({
  workstreams,
  accounts,
  initialAccountId = '',
}: {
  workstreams: Workstream[]
  accounts: Account[]
  initialAccountId?: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [workstreamId, setWorkstreamId] = useState('')
  const [accountId, setAccountId] = useState(initialAccountId)
  const [status, setStatus] = useState<ContactStatus>('lead')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const { contact } = await apiFetch<{ contact: Contact }>('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          company,
          email,
          phone,
          role,
          workstream_id: workstreamId || null,
          account_id: accountId || null,
          status,
          notes,
        }),
      })

      router.push(`/crm/contacts/${contact.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">CRM</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">New contact</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Company</span>
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Phone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Role</span>
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
        <div className="space-y-2">
          <span className="text-sm text-slate-300">Account</span>
          <SearchSelect
            label=""
            value={accountId}
            options={accounts.map((account) => ({
              value: account.id,
              label: account.name,
              meta: account.website ?? account.industry ?? null,
            }))}
            onChange={setAccountId}
            placeholder="Search accounts"
            emptyLabel="No account"
          />
        </div>
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Workstream</span>
          <select
            value={workstreamId}
            onChange={(event) => setWorkstreamId(event.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">None</option>
            {workstreams.map((workstream) => (
              <option key={workstream.id} value={workstream.id}>
                {workstream.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ContactStatus)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {CONTACT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={6}
            className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/crm/contacts')}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
