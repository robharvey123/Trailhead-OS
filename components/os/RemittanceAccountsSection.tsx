'use client'

// Settings section for remittance accounts: the beneficiary blocks printed on
// invoice PDFs and emails, per currency and rail. Values are entered here in
// production only; nothing is seeded and nothing lives in the repo.

import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import {
  RAIL_FIELDS,
  RAIL_LABELS,
  REMITTANCE_CURRENCIES,
  REMITTANCE_RAILS,
  maskNumber,
  validateRemittanceAccount,
} from '@/lib/remittance'
import type { RemittanceAccount, RemittanceRail } from '@/lib/types'

const FIELD_LABELS: Record<string, string> = {
  beneficiary_name: 'Beneficiary name',
  beneficiary_address: 'Beneficiary address',
  bank_name: 'Bank name',
  bank_address: 'Bank address',
  sort_code: 'Sort code',
  account_number: 'Account number',
  iban: 'IBAN',
  bic: 'BIC/SWIFT',
  intermediary_bic: 'Intermediary BIC',
  routing_number: 'Routing number (ABA)',
  account_type: 'Account type',
}
const MULTILINE = new Set(['beneficiary_address', 'bank_address'])
const PLACEHOLDERS: Record<string, string> = {
  sort_code: '12-34-56',
  iban: 'GB00 XXXX 0000 0000 0000 00',
  bic: 'XXXXGB2L',
  routing_number: '9 digits',
  account_type: 'checking or savings',
}

type Draft = Partial<RemittanceAccount> & { currency: RemittanceAccount['currency']; rail: RemittanceRail }

function emptyDraft(currency: RemittanceAccount['currency']): Draft {
  const rail: RemittanceRail = currency === 'GBP' ? 'uk_local' : currency === 'EUR' ? 'sepa' : 'us_local'
  return { currency, rail, label: '', beneficiary_name: '', sort_order: 0, active: true }
}

export default function RemittanceAccountsSection({ initialAccounts }: { initialAccounts: RemittanceAccount[] }) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const grouped = useMemo(() => {
    const map = new Map<string, RemittanceAccount[]>()
    for (const c of REMITTANCE_CURRENCIES) map.set(c, [])
    for (const a of accounts) map.get(a.currency)?.push(a)
    for (const list of map.values()) list.sort((x, y) => x.sort_order - y.sort_order || x.label.localeCompare(y.label))
    return map
  }, [accounts])

  function openAdd(currency: RemittanceAccount['currency']) {
    setEditingId(null)
    setErrors({})
    setDraft(emptyDraft(currency))
  }
  function openEdit(a: RemittanceAccount) {
    setEditingId(a.id)
    setErrors({})
    setDraft({ ...a })
  }
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  async function save() {
    if (!draft) return
    const clientErrors = validateRemittanceAccount(draft as never)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) return
    setBusy(true)
    setError('')
    try {
      if (editingId) {
        const { account } = await apiFetch<{ account: RemittanceAccount }>(`/api/remittance-accounts/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
        })
        setAccounts((cur) => cur.map((a) => (a.id === editingId ? account : a)))
      } else {
        const { account } = await apiFetch<{ account: RemittanceAccount }>('/api/remittance-accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
        })
        setAccounts((cur) => [...cur, account])
      }
      setDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(a: RemittanceAccount) {
    try {
      const { account } = await apiFetch<{ account: RemittanceAccount }>(`/api/remittance-accounts/${a.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !a.active }),
      })
      setAccounts((cur) => cur.map((x) => (x.id === a.id ? account : x)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

  async function remove(a: RemittanceAccount) {
    if (!confirm(`Delete "${a.label}" (${a.currency})? Invoices already issued keep their PDFs; new ones simply stop printing it.`)) return
    try {
      await apiFetch(`/api/remittance-accounts/${a.id}`, { method: 'DELETE' })
      setAccounts((cur) => cur.filter((x) => x.id !== a.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const inputClass = 'os-input w-full rounded-2xl px-4 py-3 text-sm'
  const labelClass = 'text-sm font-medium text-[color:var(--text-2)]'

  return (
    <div>
      {(REMITTANCE_CURRENCIES as readonly string[]).map((currency) => {
        const list = grouped.get(currency) ?? []
        return (
          <div key={currency} className="mt-5 first:mt-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[color:var(--text)]">{currency}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAdd(currency as RemittanceAccount['currency'])}>
                + Add {currency} account
              </button>
            </div>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-[color:var(--text-3)]">
                No accounts. {currency} invoices keep the legacy payment block until one is added here.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
                    <tr><th className="pb-2">Label</th><th className="pb-2">Rail</th><th className="pb-2">Number</th><th className="pb-2 text-right">Order</th><th className="pb-2">Active</th><th className="pb-2" /></tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.id} className="border-t border-[color:var(--border)]">
                        <td className="py-2.5 font-medium text-[color:var(--text)]">{a.label}</td>
                        <td className="py-2.5 text-[color:var(--text-2)]">{RAIL_LABELS[a.rail]}</td>
                        <td className="py-2.5 font-mono text-xs text-[color:var(--text-2)]">{maskNumber(a.iban ?? a.account_number)}</td>
                        <td className="py-2.5 text-right text-[color:var(--text-2)]">{a.sort_order}</td>
                        <td className="py-2.5">
                          <button type="button" onClick={() => void toggleActive(a)} className={`rounded-full border px-2.5 py-0.5 text-xs ${a.active ? 'border-[color:var(--emerald)] bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]' : 'border-[color:var(--border)] text-[color:var(--text-3)]'}`}>
                            {a.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-2.5 text-right">
                          <button type="button" className="text-xs text-[color:var(--accent-strong)] hover:underline" onClick={() => openEdit(a)}>Edit</button>
                          <button type="button" className="ml-3 text-xs text-[color:var(--red-strong)] hover:underline" onClick={() => void remove(a)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {error ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <h2 className="os-section-title">{editingId ? 'Edit account' : `Add ${draft.currency} account`}</h2>
            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className={labelClass}>Rail</span>
                <select className="os-select w-full" value={draft.rail} onChange={(e) => set('rail', e.target.value as RemittanceRail)}>
                  {REMITTANCE_RAILS.map((r) => (<option key={r} value={r}>{RAIL_LABELS[r]}</option>))}
                </select>
              </label>
              <label className="space-y-2">
                <span className={labelClass}>Label</span>
                <input className={inputClass} value={draft.label ?? ''} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Trailhead GBP current account" />
                {errors.label ? <span className="text-xs text-[color:var(--red-strong)]">{errors.label}</span> : null}
              </label>
              {RAIL_FIELDS[draft.rail].map((field) => (
                <label key={field} className="space-y-2">
                  <span className={labelClass}>{FIELD_LABELS[field]}</span>
                  {MULTILINE.has(field) ? (
                    <textarea rows={2} className="os-textarea w-full rounded-2xl px-4 py-3 text-sm" value={(draft[field as keyof Draft] as string | null) ?? ''} onChange={(e) => set(field as keyof Draft, e.target.value as never)} />
                  ) : (
                    <input className={inputClass} value={(draft[field as keyof Draft] as string | null) ?? ''} placeholder={PLACEHOLDERS[field]} onChange={(e) => set(field as keyof Draft, e.target.value as never)} />
                  )}
                  {errors[field] ? <span className="text-xs text-[color:var(--red-strong)]">{errors[field]}</span> : null}
                </label>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className={labelClass}>Print order</span>
                  <input type="number" min={0} step={1} className={inputClass} value={draft.sort_order ?? 0} onChange={(e) => set('sort_order', Number(e.target.value))} />
                  <span className="text-xs text-[color:var(--text-3)]">Lower prints first (e.g. USD local 0, SWIFT 1).</span>
                </label>
                <label className="flex items-center gap-2 self-end pb-3 text-sm text-[color:var(--text-2)]">
                  <input type="checkbox" checked={draft.active !== false} onChange={(e) => set('active', e.target.checked)} /> Active
                </label>
              </div>
              <label className="space-y-2">
                <span className={labelClass}>Notes (printed under the block)</span>
                <input className={inputClass} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>
            {error ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)]" onClick={() => setDraft(null)}>Cancel</button>
              <button type="button" className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : 'Save account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
