'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import type { TimeEntry, Account } from '@/lib/types'

interface Filters {
  account_id?: string
  project_id?: string
  date_from?: string
  date_to?: string
  billable?: boolean
}

export default function TimesheetClient({
  accounts,
}: {
  accounts: Account[]
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [filters, setFilters] = useState<Filters>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultDateFrom = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const start = new Date(now.setDate(diff))
    return start.toISOString().split('T')[0]
  }, [])

  const defaultDateTo = useMemo(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const start = new Date(now.setDate(diff))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return end.toISOString().split('T')[0]
  }, [])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.account_id) params.append('account_id', filters.account_id)
      if (filters.project_id) params.append('project_id', filters.project_id)
      params.append('date_from', filters.date_from || defaultDateFrom)
      params.append('date_to', filters.date_to || defaultDateTo)
      if (typeof filters.billable === 'boolean') params.append('billable', String(filters.billable))

      const response = await apiFetch<{ entries: TimeEntry[] }>(
        `/api/timesheet?${params.toString()}`
      )

      setEntries(response.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [filters, defaultDateFrom, defaultDateTo])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === filters.account_id),
    [filters.account_id, accounts]
  )

  const totals = useMemo(() => {
    let totalMinutes = 0
    let billableMinutes = 0
    let billableAmount = 0

    for (const entry of entries) {
      totalMinutes += entry.duration_minutes
      if (entry.billable) {
        billableMinutes += entry.duration_minutes
        billableAmount += (entry.duration_minutes / 60) * entry.rate_snapshot
      }
    }

    return {
      totalMinutes,
      billableMinutes,
      billableAmount,
      totalHours: (totalMinutes / 60).toFixed(1),
      billableHours: (billableMinutes / 60).toFixed(1),
    }
  }, [entries])

  return (
    <div className="min-h-screen bg-[#0C0C14] p-6">
      <div className="max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#B8FF00]">Commercial</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Timesheet</h1>
        </div>

        {/* Filters */}
        <div className="mb-6 grid gap-4 rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs text-[#9CA3AF]">Client</span>
            <select
              value={filters.account_id || ''}
              onChange={(e) =>
                setFilters({ ...filters, account_id: e.target.value || undefined })
              }
              className="w-full rounded-xl border border-[#2A2A3A] bg-[#13131E] px-3 py-2 text-sm text-white"
            >
              <option value="">All clients</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[#9CA3AF]">From</span>
            <input
              type="date"
              value={filters.date_from || defaultDateFrom}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full rounded-xl border border-[#2A2A3A] bg-[#13131E] px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[#9CA3AF]">To</span>
            <input
              type="date"
              value={filters.date_to || defaultDateTo}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="w-full rounded-xl border border-[#2A2A3A] bg-[#13131E] px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        {/* Totals Summary */}
        {selectedAccount && (
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-4">
              <p className="text-xs text-[#9CA3AF]">Client</p>
              <p className="mt-1 text-lg font-semibold text-white">{selectedAccount.name}</p>
            </div>
            <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-4">
              <p className="text-xs text-[#9CA3AF]">Hours logged</p>
              <p className="mt-1 text-lg font-semibold text-white">{totals.totalHours}h</p>
            </div>
            <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-4">
              <p className="text-xs text-[#9CA3AF]">Billable hours</p>
              <p className="mt-1 text-lg font-semibold text-white">{totals.billableHours}h</p>
            </div>
            <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-4">
              <p className="text-xs text-[#9CA3AF]">Billable amount</p>
              <p className="mt-1 text-lg font-semibold text-[#B8FF00]">
                {formatCurrency(totals.billableAmount, 'GBP')}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Entries Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#2A2A3A]">
          {loading ? (
            <div className="flex items-center justify-center bg-[#1A1A28] p-8 text-[#9CA3AF]">
              Loading entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center bg-[#1A1A28] p-8 text-[#9CA3AF]">
              No time entries found
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A3A] bg-[#13131E]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#B8FF00]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#B8FF00]">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#B8FF00]">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#B8FF00]">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[#B8FF00]">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#B8FF00]">Billable</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[#2A2A3A] bg-[#1A1A28] hover:bg-[#232335]"
                  >
                    <td className="px-4 py-3 text-sm text-white">{entry.entry_date}</td>
                    <td className="px-4 py-3 text-sm text-[#9CA3AF]">
                      {entry.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {(entry.duration_minutes / 60).toFixed(2)}h
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      {formatCurrency(entry.rate_snapshot, entry.currency_snapshot || 'GBP')}/h
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#B8FF00]">
                      {entry.billable
                        ? formatCurrency(
                            (entry.duration_minutes / 60) * entry.rate_snapshot,
                            entry.currency_snapshot || 'GBP'
                          )
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.billable ? (
                        <span className="inline-block rounded-full bg-green-900 px-2.5 py-0.5 text-xs font-medium text-green-200">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-300">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
