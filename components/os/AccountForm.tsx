'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import PageHeader from '@/components/ui/PageHeader'
import { ACCOUNT_INDUSTRY_OPTIONS, ACCOUNT_SIZE_OPTIONS } from '@/lib/crm/account-options'
import type { Account, AccountStatus, AccountWithRelations, Workstream } from '@/lib/types'

const ACCOUNT_STATUSES: AccountStatus[] = [
  'prospect',
  'contacted',
  'active',
  'listed',
  'declined',
  'on_hold',
  'inactive',
  'archived',
]

const STATUS_LABELS: Record<AccountStatus, string> = {
  prospect: 'Prospect',
  contacted: 'Contacted',
  active: 'Active',
  listed: 'Listed',
  declined: 'Declined',
  on_hold: 'On Hold',
  inactive: 'Inactive',
  archived: 'Archived',
}

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
    channel: initialAccount?.channel ?? '',
    source: initialAccount?.source ?? '',
    email_contact: initialAccount?.email_contact ?? '',
    hq_address: initialAccount?.hq_address ?? '',
    address_line1: initialAccount?.address_line1 ?? '',
    address_line2: initialAccount?.address_line2 ?? '',
    city: initialAccount?.city ?? '',
    postcode: initialAccount?.postcode ?? '',
    country: initialAccount?.country ?? 'UK',
    vat_number: initialAccount?.vat_number ?? '',
    company_number: initialAccount?.company_number ?? '',
    billing_email: initialAccount?.billing_email ?? '',
    payment_terms_days: initialAccount?.payment_terms_days != null ? String(initialAccount.payment_terms_days) : '',
    po_required: initialAccount?.po_required ?? false,
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
        payment_terms_days: form.payment_terms_days.trim() ? Number(form.payment_terms_days) : null,
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
    <>
      {!onSaved ? (
        <PageHeader eyebrow="Clients" title={initialAccount ? 'Edit account' : 'New account'} />
      ) : null}
      <div className="os-card space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="field-label block">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
              required
            />
          </label>

          <label className="block">
            <span className="field-label block">Website</span>
            <input
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">Industry</span>
            <select
              value={form.industry}
              onChange={(event) => setForm({ ...form, industry: event.target.value })}
              className="os-select w-full px-4 py-3 text-sm"
            >
              <option value="">Select industry</option>
              {ACCOUNT_INDUSTRY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label block">Company size</span>
            <select
              value={form.size}
              onChange={(event) => setForm({ ...form, size: event.target.value })}
              className="os-select w-full px-4 py-3 text-sm"
            >
              <option value="">Select size</option>
              {ACCOUNT_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label block">Workstream</span>
            <select
              value={form.workstream_id}
              onChange={(event) => setForm({ ...form, workstream_id: event.target.value })}
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

          <label className="block md:col-span-2">
            <span className="field-label block">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as AccountStatus })}
              className="os-select w-full px-4 py-3 text-sm"
            >
              {ACCOUNT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label block">Channel</span>
            <input
              value={form.channel}
              onChange={(event) => setForm({ ...form, channel: event.target.value })}
              placeholder="e.g. Major UK Retailers"
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">Source</span>
            <input
              value={form.source}
              onChange={(event) => setForm({ ...form, source: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">Email contact</span>
            <input
              type="email"
              value={form.email_contact}
              onChange={(event) => setForm({ ...form, email_contact: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">HQ / Address</span>
            <input
              value={form.hq_address}
              onChange={(event) => setForm({ ...form, hq_address: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="field-label block">Address line 1</span>
            <input
              value={form.address_line1}
              onChange={(event) => setForm({ ...form, address_line1: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label block">Address line 2</span>
            <input
              value={form.address_line2}
              onChange={(event) => setForm({ ...form, address_line2: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">City</span>
            <input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="field-label block">Postcode</span>
            <input
              value={form.postcode}
              onChange={(event) => setForm({ ...form, postcode: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="field-label block">Country</span>
            <input
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
              className="os-input w-full px-4 py-3 text-sm"
            />
          </label>

          <div className="md:col-span-2 rounded-card border border-[var(--border)] p-4">
            <p className="text-sm font-semibold text-[var(--text)]">Billing</p>
            <p className="mt-1 text-xs text-[var(--text-2)]">Flows onto invoices raised against this account.</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="field-label block">VAT number</span>
                <input
                  value={form.vat_number}
                  onChange={(event) => setForm({ ...form, vat_number: event.target.value })}
                  className="os-input w-full px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="field-label block">Company number</span>
                <input
                  value={form.company_number}
                  onChange={(event) => setForm({ ...form, company_number: event.target.value })}
                  className="os-input w-full px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="field-label block">Billing email</span>
                <input
                  type="email"
                  value={form.billing_email}
                  onChange={(event) => setForm({ ...form, billing_email: event.target.value })}
                  placeholder="accounts@…"
                  className="os-input w-full px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="field-label block">Payment terms (days)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.payment_terms_days}
                  onChange={(event) => setForm({ ...form, payment_terms_days: event.target.value })}
                  placeholder="e.g. 30"
                  className="os-input w-full px-4 py-3 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.po_required}
                  onChange={(event) => setForm({ ...form, po_required: event.target.checked })}
                />
                <span className="text-sm text-[var(--text-2)]">PO number required on every invoice</span>
              </label>
            </div>
          </div>

          <label className="block md:col-span-2">
            <span className="field-label block">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={6}
              className="os-textarea w-full px-4 py-3 text-sm"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-[var(--red-strong)]">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="btn btn-primary"
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
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
