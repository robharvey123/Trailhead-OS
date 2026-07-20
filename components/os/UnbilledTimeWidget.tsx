'use client'

import { useCallback, useEffect, useState } from 'react'
import type { UnbilledTimeGroup } from '@/lib/types'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2)
}

export default function UnbilledTimeWidget({
  accountId,
  onSelect,
}: {
  accountId: string
  onSelect?: (selected: UnbilledTimeGroup[]) => void
}) {
  const [groups, setGroups] = useState<UnbilledTimeGroup[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(Boolean(accountId))
  const [fetchKey, setFetchKey] = useState(0)

  // Each group is keyed by its project (null project → 'general').
  const keyOf = (g: UnbilledTimeGroup) => g.project_id ?? 'general'

  useEffect(() => {
    setFetchKey((k) => k + 1)
  }, [accountId])

  const fetchGroups = useCallback(async () => {
    if (!accountId) return

    try {
      const res = await fetch(`/api/timesheet/unbilled?account_id=${encodeURIComponent(accountId)}`)
      const data = await res.json()
      setGroups(data.groups ?? [])
      setSelectedKeys(new Set())
    } catch {
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups, fetchKey])

  function toggleGroup(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedKeys.size === groups.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(groups.map(keyOf)))
    }
  }

  function handleAddToInvoice() {
    const selected = groups.filter((g) => selectedKeys.has(keyOf(g)))
    onSelect?.(selected)
  }

  const selectedTotal = groups
    .filter((g) => selectedKeys.has(keyOf(g)))
    .reduce((sum, g) => sum + g.amount, 0)

  const totalAmount = groups.reduce((sum, g) => sum + g.amount, 0)

  if (loading) {
    return (
      <div className="os-card p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
    )
  }

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-[color:var(--amber)] bg-[var(--amber-dim)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[color:var(--amber-strong)]">
          {groups.length} unbilled time group{groups.length !== 1 ? 's' : ''} totalling {formatMoney(totalAmount)}
        </p>
        <label className="flex items-center gap-2 text-xs text-[color:var(--text-2)]">
          <input
            type="checkbox"
            checked={selectedKeys.size === groups.length && groups.length > 0}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
          />
          Select all
        </label>
      </div>

      <div className="space-y-1">
        {groups.map((group) => {
          const key = keyOf(group)
          return (
            <label
              key={key}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[var(--surface-2)]"
            >
              <input
                type="checkbox"
                checked={selectedKeys.has(key)}
                onChange={() => toggleGroup(key)}
                className="h-4 w-4 rounded border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--accent)] focus:ring-[color:var(--accent)]"
              />
              <span className="flex-1 text-sm text-[color:var(--text-2)]">{group.project_name}</span>
              <span className="text-xs text-[color:var(--text-3)]">
                {formatHours(group.minutes)}h @ {formatMoney(group.rate)}/h
              </span>
              <span className="text-sm font-medium text-[color:var(--text)]">{formatMoney(group.amount)}</span>
            </label>
          )
        })}
      </div>

      {selectedKeys.size > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-[color:var(--border)]">
          <p className="text-sm text-[color:var(--text-2)]">
            Selected: <span className="font-medium text-[color:var(--text)]">{formatMoney(selectedTotal)}</span>
          </p>
          <button
            type="button"
            onClick={handleAddToInvoice}
            className="rounded-xl bg-[var(--amber-dim)] px-4 py-2 text-sm font-medium text-[color:var(--amber-strong)] transition hover:bg-[var(--amber)]"
          >
            Add to invoice
          </button>
        </div>
      )}
    </div>
  )
}
