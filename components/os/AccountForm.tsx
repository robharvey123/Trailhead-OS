'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { ACCOUNT_INDUSTRY_OPTIONS, ACCOUNT_SIZE_OPTIONS } from '@/lib/crm/account-options'
import type { Account, AccountStatus, AccountWithRelations, Workstream } from '@/lib/types'

const ACCOUNT_STATUSES: AccountStatus[] = [
  'prospect',
  'active',
  'inactive',
  'archived',
]

interface AccountFormProps {
  workstreams: Workstream[]
  initialAccount?: Account | AccountWithRelations | null
  cancelHref?: string
  onSaved?: (account: AccountWithRelations) => void
  onCancel?: () => void
}

export default function AccountForm({
  workstreams,
  initialAccount = null,
  cancelHref = '/crm/accounts',
  onSaved,
  onCancel,
}: AccountFormProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: initialAccount?.name ?? '',
    website: initialAccount?.website ?? '',
    industry: initialAccount?.industry ?? '',
    size: initialAccount?.size ?? '',
    workstream_id: initialAccount?.workstream_id ?? '',
    status: initialAccount?.status ?? ('prospect' as AccountStatus),
    address_line1: initialAccount?.address_line1 ?? '',
    address_line2: initialAccount?.address_line2 ?? '',
    city: initialAccount?.city ?? '',
    postcode: initialAccount?.postcode ?? '',
    country: initialAccount?.country ?? 'UK',
    notes: initialAccount?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        workstream_id: form.workstream_id || null,
        size: form.size || null,
      }

      const response = initialAccount?.id
        ? await apiFetch<{ account: AccountWithRelations }>(`/api/accounts/${initialAccount.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ account: AccountWithRelations }>('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      onSaved?.(response.account)

      if (!onSaved) {
        router.push(`/crm/accounts/${response.account.id}`)
        router.refresh()
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save account')
      setSaving(false)
      return
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      {!onSaved ? (
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">
            {initialAccount ? 'Edit account' : 'New account'}
          </h1>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Website</span>
          <input
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Industry</span>
          <select
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">Select industry</option>
            {ACCOUNT_INDUSTRY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Company size</span>
          <select
            value={form.size}
            onChange={(event) => setForm({ ...form, size: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">Select size</option>
            {ACCOUNT_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Workstream</span>
          <select
            value={form.workstream_id}
            onChange={(event) => setForm({ ...form, workstream_id: event.target.value })}
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
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as AccountStatus })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {ACCOUNT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Address line 1</span>
          <input
            value={form.address_line1}
            onChange={(event) => setForm({ ...form, address_line1: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Address line 2</span>
          <input
            value={form.address_line2}
            onChange={(event) => setForm({ ...form, address_line2: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">City</span>
          <input
            value={form.city}
            onChange={(event) => setForm({ ...form, city: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Postcode</span>
          <input
            value={form.postcode}
            onChange={(event) => setForm({ ...form, postcode: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Country</span>
          <input
            value={form.country}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
          disabled={saving || !form.name.trim()}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (onCancel) {
              onCancel()
              return
            }

            router.push(cancelHref)
          }}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
