'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import EntityCombobox from './EntityCombobox'
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
  const [showCompany, setShowCompany] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [channel, setChannel] = useState('')
  const [website, setWebsite] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')
  const [country, setCountry] = useState('UK')
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
          channel,
          website,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city,
          postcode,
          country,
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
    <div className="os-card space-y-6 p-6">
      <div>
        <p className="os-eyebrow">CRM</p>
        <h1 className="os-page-title mt-2">New contact</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
            required
          />
        </label>
        {accountId ? null : showCompany ? (
          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Company (unlinked)</span>
            <input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="os-input w-full px-4 py-3 text-sm"
              placeholder="Prefer to link or create an account below"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setShowCompany(true)}
            className="text-left text-xs text-[color:var(--text-3)] transition hover:text-[color:var(--text)]"
          >
            ＋ record a company name without linking an account
          </button>
        )}
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Phone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Role</span>
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Channel</span>
          <input
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            placeholder="e.g. Online Pouch Retailers"
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Website</span>
          <input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="e.g. example.com"
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Address line 1</span>
          <input
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Address line 2</span>
          <input
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">City</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Postcode</span>
          <input
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Country</span>
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="os-input w-full px-4 py-3 text-sm"
          />
        </label>
        <EntityCombobox
          label="Account"
          entity="account"
          value={accountId}
          selectedLabel={accounts.find((a) => a.id === accountId)?.name}
          onChange={(opt) => setAccountId(opt.id)}
          clearable
        />
        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Workstream</span>
          <select
            value={workstreamId}
            onChange={(event) => setWorkstreamId(event.target.value)}
            className="os-select w-full px-4 py-3 text-sm"
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
          <span className="text-sm text-[color:var(--text-2)]">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ContactStatus)}
            className="os-select w-full px-4 py-3 text-sm"
          >
            {CONTACT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={6}
            className="os-textarea w-full px-4 py-3 text-sm"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/crm/contacts')}
          className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
