'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ExpenseWithRelations } from '@/lib/types'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function UnbilledExpensesWidget({
  accountId,
  onSelect,
}: {
  accountId: string
  onSelect?: (selected: ExpenseWithRelations[]) => void
}) {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(Boolean(accountId))
  const [fetchKey, setFetchKey] = useState(0)

  // Trigger a new fetch when accountId changes
  useEffect(() => {
    setFetchKey((k) => k + 1)
  }, [accountId])

  const fetchExpenses = useCallback(async () => {
    if (!accountId) return

    try {
      const res = await fetch(`/api/expenses/unbilled?account_id=${encodeURIComponent(accountId)}`)
      const data = await res.json()
      setExpenses(data.expenses ?? [])
      setSelectedIds(new Set())
    } catch {
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses, fetchKey])

  function toggleExpense(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(expenses.map((e) => e.id)))
    }
  }

  function handleAddToInvoice() {
    const selected = expenses.filter((e) => selectedIds.has(e.id))
    onSelect?.(selected)
  }

  const selectedTotal = expenses
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + Number(e.amount), 0)

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2A2A3A] bg-[#13131E] p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-[#2A2A3A]" />
      </div>
    )
  }

  if (expenses.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-200">
          {expenses.length} unbilled expense{expenses.length !== 1 ? 's' : ''} totalling{' '}
          {formatMoney(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}
        </p>
        <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <input
            type="checkbox"
            checked={selectedIds.size === expenses.length && expenses.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-[#2A2A3A] bg-[#0C0C14] text-sky-500 focus:ring-sky-500"
          />
          Select all
        </label>
      </div>

      <div className="space-y-1">
        {expenses.map((expense) => (
          <label
            key={expense.id}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[#2A2A3A]/50"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(expense.id)}
              onChange={() => toggleExpense(expense.id)}
              className="h-4 w-4 rounded border-[#2A2A3A] bg-[#0C0C14] text-sky-500 focus:ring-sky-500"
            />
            <span className="flex-1 text-sm text-[#9CA3AF]">{expense.description}</span>
            <span className="text-xs text-white0">{expense.date}</span>
            <span className="text-sm font-medium text-white">
              {formatMoney(Number(expense.amount))}
            </span>
          </label>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A3A]">
          <p className="text-sm text-[#9CA3AF]">
            Selected: <span className="font-medium text-white">{formatMoney(selectedTotal)}</span>
          </p>
          <button
            type="button"
            onClick={handleAddToInvoice}
            className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30"
          >
            Add to invoice
          </button>
        </div>
      )}
    </div>
  )
}
