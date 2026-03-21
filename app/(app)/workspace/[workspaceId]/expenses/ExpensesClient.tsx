'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { currencySymbol } from '@/lib/format'
import type { FinanceExpenseClaim, ExpenseCategory, ExpenseClaimStatus } from '@/lib/finance/types'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_CLAIM_STATUSES, EXPENSE_CLAIM_STATUS_LABELS, EXPENSE_CLAIM_STATUS_COLORS } from '@/lib/finance/types'

export default function ExpensesClient({
  workspaceId,
  initialExpenses,
  baseCurrency,
  supportedCurrencies,
  currentUserId,
  userRole,
}: {
  workspaceId: string
  initialExpenses: FinanceExpenseClaim[]
  baseCurrency: string
  supportedCurrencies: string[]
  currentUserId: string
  userRole: string
}) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('general')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(baseCurrency)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptUrl, setReceiptUrl] = useState('')
  const [notes, setNotes] = useState('')

  const canApprove = userRole === 'admin' || userRole === 'owner'

  const fmtCur = (v: number, code?: string) => {
    const sym = currencySymbol(code || baseCurrency)
    return `${sym}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const resetForm = () => {
    setTitle(''); setCategory('general'); setAmount(''); setCurrency(baseCurrency)
    setExpenseDate(new Date().toISOString().slice(0, 10)); setReceiptUrl(''); setNotes('')
    setEditingId(null)
  }

  const openEdit = (exp: FinanceExpenseClaim) => {
    setTitle(exp.title); setCategory(exp.category); setAmount(exp.amount.toString())
    setCurrency(exp.currency); setExpenseDate(exp.expense_date); setReceiptUrl(exp.receipt_url || '')
    setNotes(exp.notes || ''); setEditingId(exp.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, title, category, amount: parseFloat(amount),
        currency, expense_date: expenseDate, receipt_url: receiptUrl || null, notes: notes || null,
      }
      if (editingId) {
        const { expense } = await apiFetch<{ expense: FinanceExpenseClaim }>(`/api/finance/expenses/${editingId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setExpenses((prev) => prev.map((e) => e.id === editingId ? expense : e))
        toast.success('Expense updated')
      } else {
        const { expense } = await apiFetch<{ expense: FinanceExpenseClaim }>('/api/finance/expenses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setExpenses((prev) => [expense, ...prev])
        toast.success('Expense created')
      }
      resetForm(); setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, title, category, amount, currency, expenseDate, receiptUrl, notes])

  const handleStatusChange = useCallback(async (id: string, status: ExpenseClaimStatus, rejectionReason?: string) => {
    try {
      const payload: Record<string, unknown> = { workspace_id: workspaceId, status }
      if (rejectionReason) payload.rejection_reason = rejectionReason
      const { expense } = await apiFetch<{ expense: FinanceExpenseClaim }>(`/api/finance/expenses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setExpenses((prev) => prev.map((e) => e.id === id ? expense : e))
      toast.success(`Expense ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }, [workspaceId])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/finance/expenses/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      toast.success('Expense deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = useMemo(() => expenses.filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterCategory !== 'all' && e.category !== filterCategory) return false
    return true
  }), [expenses, filterStatus, filterCategory])

  const totals = useMemo(() => ({
    total: filtered.reduce((s, e) => s + e.amount, 0),
    pending: filtered.filter((e) => e.status === 'submitted').reduce((s, e) => s + e.amount, 0),
    approved: filtered.filter((e) => ['approved', 'paid'].includes(e.status)).reduce((s, e) => s + e.amount, 0),
  }), [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-slate-400">
            Total: {fmtCur(totals.total)} &middot; Pending: {fmtCur(totals.pending)} &middot; Approved: {fmtCur(totals.approved)}
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Expense</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Statuses</option>
          {EXPENSE_CLAIM_STATUSES.map((s) => <option key={s} value={s}>{EXPENSE_CLAIM_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'New Expense Claim'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount *</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                {supportedCurrencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date *</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Receipt URL</label>
              <input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false) }} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs uppercase tracking-wide text-slate-400 hover:text-white">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-16">
          <div className="mb-3 text-4xl text-slate-600">🧾</div>
          <p className="text-slate-400">No expense claims yet</p>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="mt-3 text-xs text-blue-400 hover:underline">Create your first expense claim</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((exp) => (
                <tr key={exp.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3 whitespace-nowrap">{exp.expense_date}</td>
                  <td className="px-4 py-3 font-medium">{exp.title}</td>
                  <td className="px-4 py-3">{EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtCur(exp.amount, exp.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold uppercase ${EXPENSE_CLAIM_STATUS_COLORS[exp.status] || 'text-slate-400'}`}>
                      {EXPENSE_CLAIM_STATUS_LABELS[exp.status] || exp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {exp.status === 'draft' && (
                      <>
                        <button onClick={() => handleStatusChange(exp.id, 'submitted')} className="text-xs text-blue-400 hover:underline">Submit</button>
                        <button onClick={() => openEdit(exp)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                        <button onClick={() => handleDelete(exp.id)} className="text-xs text-rose-400 hover:underline">Delete</button>
                      </>
                    )}
                    {exp.status === 'submitted' && canApprove && (
                      <>
                        <button onClick={() => handleStatusChange(exp.id, 'approved')} className="text-xs text-emerald-400 hover:underline">Approve</button>
                        <button onClick={() => { const reason = prompt('Rejection reason:'); if (reason) handleStatusChange(exp.id, 'rejected', reason) }} className="text-xs text-rose-400 hover:underline">Reject</button>
                      </>
                    )}
                    {exp.status === 'approved' && canApprove && (
                      <button onClick={() => handleStatusChange(exp.id, 'paid')} className="text-xs text-cyan-400 hover:underline">Mark Paid</button>
                    )}
                    {exp.rejection_reason && <span className="text-xs text-rose-300" title={exp.rejection_reason}>ⓘ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
