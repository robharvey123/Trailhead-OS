'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type {
  Account,
  Expense,
  ExpenseCategory,
  Workstream,
} from '@/lib/types'

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'travel', label: 'Travel' },
  { value: 'software', label: 'Software' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'meals', label: 'Meals' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'other', label: 'Other' },
]

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function ExpenseForm({
  accounts,
  workstreams,
  initialExpense,
}: {
  accounts: Account[]
  workstreams: Workstream[]
  initialExpense?: Expense
}) {
  const router = useRouter()
  const isEdit = Boolean(initialExpense)

  const [date, setDate] = useState(
    initialExpense?.date ?? new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState(initialExpense?.description ?? '')
  const [amount, setAmount] = useState(
    initialExpense ? String(initialExpense.amount) : ''
  )
  const [currency] = useState(initialExpense?.currency ?? 'GBP')
  const [category, setCategory] = useState<ExpenseCategory>(
    (initialExpense?.category as ExpenseCategory) ?? 'other'
  )
  const [workstreamId, setWorkstreamId] = useState(initialExpense?.workstream_id ?? '')
  const [accountId, setAccountId] = useState(initialExpense?.account_id ?? '')
  const [billable, setBillable] = useState(initialExpense?.billable ?? false)
  const [taxDeductible, setTaxDeductible] = useState(initialExpense?.tax_deductible ?? true)
  const [notes, setNotes] = useState(initialExpense?.notes ?? '')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setError('Description is required.')
      setSaving(false)
      return
    }

    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError('Enter a valid amount.')
      setSaving(false)
      return
    }

    try {
      const payload = {
        date,
        description: trimmedDescription,
        amount: numAmount,
        currency,
        category,
        workstream_id: workstreamId || null,
        account_id: accountId || null,
        billable,
        tax_deductible: taxDeductible,
        notes: notes.trim() || null,
      }

      let expenseId: string

      if (isEdit && initialExpense) {
        const res = await fetch(`/api/expenses/${initialExpense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update expense')
        expenseId = data.expense.id
      } else {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create expense')
        expenseId = data.expense.id
      }

      // Upload receipt if a file was selected
      if (receiptFile) {
        const formData = new FormData()
        formData.append('file', receiptFile)

        const uploadRes = await fetch(`/api/expenses/${expenseId}/receipt`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json()
          console.error('Receipt upload failed:', uploadData.error)
        }
      }

      router.push(`/expenses/${expenseId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialExpense) return
    if (!confirm('Delete this expense? This cannot be undone.')) return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/expenses/${initialExpense.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete expense')
      }
      router.push('/expenses')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Finance</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">
          {isEdit ? 'Edit expense' : 'Add expense'}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm text-slate-300">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Train to London for client meeting"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Amount (£)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Currency</span>
          <input
            type="text"
            value={currency}
            disabled
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-400"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Workstream</span>
          <select
            value={workstreamId}
            onChange={(e) => setWorkstreamId(e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">No workstream</option>
            {workstreams.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Account</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">No account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes…"
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Receipt</span>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 file:mr-4 file:rounded-full file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-200"
          />
          {initialExpense?.receipt_url && !receiptFile && (
            <a
              href={initialExpense.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-sky-300 hover:text-sky-200"
            >
              View existing receipt ↗
            </a>
          )}
        </label>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-300">Billable to client</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={taxDeductible}
            onChange={(e) => setTaxDeductible(e.target.checked)}
            className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500"
          />
          <span className="text-sm text-slate-300">Tax deductible</span>
        </label>
      </div>

      {/* Summary */}
      {amount && Number(amount) > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
          <p className="text-sm text-slate-400">
            Amount: <span className="font-medium text-slate-100">{formatMoney(Number(amount))}</span>
            {billable && (
              <span className="ml-3 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
                Billable
              </span>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || deleting}
          className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {saving ? 'Saving…' : isEdit ? 'Update expense' : 'Save expense'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving || deleting}
          className="rounded-2xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
        >
          Cancel
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="ml-auto rounded-2xl border border-rose-500/30 px-6 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}
