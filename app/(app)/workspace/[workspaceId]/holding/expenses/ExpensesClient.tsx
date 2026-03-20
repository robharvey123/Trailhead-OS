'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { HoldingExpense, ExpenseCategory, IncomeStream } from '@/lib/holding/types'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from '@/lib/holding/types'

const fmtCurrency = (v: number) => `£${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

export default function ExpensesClient({ workspaceId }: { workspaceId: string }) {
  const [expenses, setExpenses] = useState<HoldingExpense[]>([])
  const [streams, setStreams] = useState<IncomeStream[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [filterStream, setFilterStream] = useState<string>('all')

  // Form
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('operations')
  const [streamId, setStreamId] = useState('')
  const [amount, setAmount] = useState('0')
  const [currency, setCurrency] = useState('GBP')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [vendor, setVendor] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePeriod, setRecurrencePeriod] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setDescription(''); setCategory('operations'); setStreamId(''); setAmount('0'); setCurrency('GBP')
    setExpenseDate(new Date().toISOString().slice(0, 10)); setVendor(''); setIsRecurring(false)
    setRecurrencePeriod(''); setNotes(''); setEditingId(null)
  }

  const load = useCallback(async () => {
    try {
      const [eRes, sRes] = await Promise.all([
        apiFetch<{ expenses: HoldingExpense[] }>(`/api/holding/expenses?workspace_id=${workspaceId}`),
        apiFetch<{ streams: IncomeStream[] }>(`/api/holding/streams?workspace_id=${workspaceId}`),
      ])
      setExpenses(eRes.expenses ?? [])
      setStreams(sRes.streams ?? [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const streamMap = new Map(streams.map((s) => [s.id, s.name]))

  const openEdit = (exp: HoldingExpense) => {
    setDescription(exp.description); setCategory(exp.category); setStreamId(exp.stream_id || '')
    setAmount(exp.amount.toString()); setCurrency(exp.currency); setExpenseDate(exp.expense_date)
    setVendor(exp.vendor || ''); setIsRecurring(exp.is_recurring)
    setRecurrencePeriod(exp.recurrence_period || ''); setNotes(exp.notes || '')
    setEditingId(exp.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, description, category, stream_id: streamId || null,
        amount: parseFloat(amount) || 0, currency, expense_date: expenseDate,
        vendor: vendor || null, is_recurring: isRecurring,
        recurrence_period: isRecurring ? recurrencePeriod || null : null, notes: notes || null,
      }
      if (editingId) {
        const { expense } = await apiFetch<{ expense: HoldingExpense }>(`/api/holding/expenses/${editingId}?workspace_id=${workspaceId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setExpenses((prev) => prev.map((e) => e.id === editingId ? expense : e))
      } else {
        const { expense } = await apiFetch<{ expense: HoldingExpense }>('/api/holding/expenses', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setExpenses((prev) => [expense, ...prev])
      }
      resetForm(); setShowForm(false)
      toast.success(editingId ? 'Expense updated' : 'Expense added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, editingId, description, category, streamId, amount, currency, expenseDate, vendor, isRecurring, recurrencePeriod, notes])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/holding/expenses/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      toast.success('Expense deleted')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete') }
  }, [workspaceId])

  const filtered = expenses.filter((e) => {
    if (filterCat !== 'all' && e.category !== filterCat) return false
    if (filterStream !== 'all' && e.stream_id !== filterStream) return false
    return true
  })

  const totals = useMemo(() => ({
    total: filtered.reduce((s, e) => s + e.amount, 0),
    byCategory: EXPENSE_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = filtered.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0)
      return acc
    }, {} as Record<string, number>),
  }), [filtered])

  if (loading) {
    return (
      <div className="space-y-6">
        <header><p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p><h1 className="mt-2 text-2xl font-semibold">Expenses</h1></header>
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-1 text-2xl font-semibold">Expenses</h1>
          <p className="mt-1 text-sm text-slate-400">Total: {fmtCurrency(totals.total)}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Expense</button>
      </div>

      {/* Category Summary */}
      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {EXPENSE_CATEGORIES.filter((c) => totals.byCategory[c] > 0).map((cat) => (
          <div key={cat} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${EXPENSE_CATEGORY_COLORS[cat]}`} />
              <p className="text-xs text-slate-400">{EXPENSE_CATEGORY_LABELS[cat]}</p>
            </div>
            <p className="mt-1 text-sm font-semibold">{fmtCurrency(totals.byCategory[cat])}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={filterStream} onChange={(e) => setFilterStream(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All streams</option>
          <option value="">Company-wide</option>
          {streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'New Expense'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Description *</label><input required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Category</label><select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Stream (optional)</label><select value={streamId} onChange={(e) => setStreamId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Company-wide</option>{streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Amount *</label><input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Date</label><input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Vendor</label><input value={vendor} onChange={(e) => setVendor(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-700" />
                <label htmlFor="recurring" className="text-sm text-slate-300">Recurring</label>
              </div>
              {isRecurring && (
                <select value={recurrencePeriod} onChange={(e) => setRecurrencePeriod(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
                  <option value="">Select period</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              )}
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Stream</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No expenses found</td></tr> : filtered.map((exp) => (
              <tr key={exp.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-400">{exp.expense_date}</td>
                <td className="px-4 py-3 font-medium">
                  {exp.description}
                  {exp.is_recurring && <span className="ml-2 text-xs text-blue-400">↻ {exp.recurrence_period}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${EXPENSE_CATEGORY_COLORS[exp.category]}`} />
                    <span className="text-slate-400">{EXPENSE_CATEGORY_LABELS[exp.category]}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400">{exp.stream_id ? (streamMap.get(exp.stream_id) || '—') : 'Company'}</td>
                <td className="px-4 py-3 text-slate-400">{exp.vendor || '—'}</td>
                <td className="px-4 py-3 font-medium text-rose-400">{fmtCurrency(exp.amount)}</td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(exp)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(exp.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
