'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { FinanceBudget, BudgetCategory } from '@/lib/finance/types'
import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS } from '@/lib/finance/types'

const catColors: Record<BudgetCategory, string> = {
  marketing: 'bg-purple-500', operations: 'bg-blue-500', staffing: 'bg-amber-500',
  product: 'bg-cyan-500', logistics: 'bg-emerald-500', general: 'bg-slate-500',
}

export default function BudgetsClient({ workspaceId, initialBudgets }: { workspaceId: string; initialBudgets: FinanceBudget[] }) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')

  const [name, setName] = useState('')
  const [category, setCategory] = useState<BudgetCategory>('general')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [allocated, setAllocated] = useState('0')
  const [spent, setSpent] = useState('0')
  const [notes, setNotes] = useState('')

  const resetForm = () => { setName(''); setCategory('general'); setPeriodStart(''); setPeriodEnd(''); setAllocated('0'); setSpent('0'); setNotes(''); setEditingId(null) }

  const openEdit = (b: FinanceBudget) => {
    setName(b.name); setCategory(b.category); setPeriodStart(b.period_start); setPeriodEnd(b.period_end)
    setAllocated(b.allocated.toString()); setSpent(b.spent.toString()); setNotes(b.notes || '')
    setEditingId(b.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = { workspace_id: workspaceId, name, category, period_start: periodStart, period_end: periodEnd, allocated: parseFloat(allocated) || 0, spent: parseFloat(spent) || 0, notes: notes || null }
    if (editingId) {
      const { budget } = await apiFetch<{ budget: FinanceBudget }>(`/api/finance/budgets/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setBudgets((prev) => prev.map((b) => b.id === editingId ? budget : b))
    } else {
      const { budget } = await apiFetch<{ budget: FinanceBudget }>('/api/finance/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setBudgets((prev) => [budget, ...prev])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Budget updated' : 'Budget created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, name, category, periodStart, periodEnd, allocated, spent, notes])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/finance/budgets/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setBudgets((prev) => prev.filter((b) => b.id !== id))
      toast.success('Budget deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = budgets.filter((b) => filterCat === 'all' || b.category === filterCat)
  const totals = useMemo(() => ({ allocated: filtered.reduce((s, b) => s + b.allocated, 0), spent: filtered.reduce((s, b) => s + b.spent, 0) }), [filtered])
  const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold">Budgets</h1>
          <p className="mt-1 text-sm text-slate-400">Allocated: {fmtCurrency(totals.allocated)} &middot; Spent: {fmtCurrency(totals.spent)} &middot; Remaining: {fmtCurrency(totals.allocated - totals.spent)}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Budget</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All categories</option>
          {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{BUDGET_CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Budget' : 'New Budget'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Name *</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Category</label><select value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{BUDGET_CATEGORY_LABELS[c]}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs text-slate-400">Start</label><input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div><div><label className="mb-1 block text-xs text-slate-400">End</label><input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div></div>
              <div><label className="mb-1 block text-xs text-slate-400">Allocated</label><input type="number" step="0.01" value={allocated} onChange={(e) => setAllocated(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Spent</label><input type="number" step="0.01" value={spent} onChange={(e) => setSpent(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? <p className="col-span-full text-center text-slate-500 py-8">No budgets found</p> : filtered.map((b) => {
          const pct = b.allocated > 0 ? Math.min((b.spent / b.allocated) * 100, 100) : 0
          const overBudget = b.spent > b.allocated
          return (
            <div key={b.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{b.name}</h3>
                  <p className="text-xs text-slate-400">{BUDGET_CATEGORY_LABELS[b.category]} &middot; {b.period_start} → {b.period_end}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                  <button onClick={() => handleDelete(b.id)} className="text-xs text-rose-400 hover:text-rose-300">×</button>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-slate-400">Spent</span><span className={overBudget ? 'text-rose-400' : 'text-slate-200'}>{fmtCurrency(b.spent)} / {fmtCurrency(b.allocated)}</span></div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-rose-500' : catColors[b.category]}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-right text-xs text-slate-500">{pct.toFixed(0)}% used &middot; {fmtCurrency(Math.max(b.allocated - b.spent, 0))} remaining</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
