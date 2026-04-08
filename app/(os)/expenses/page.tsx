import Link from 'next/link'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getExpenses, type ExpenseFilters } from '@/lib/db/expenses'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { ExpenseCategory } from '@/lib/types'

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel: 'Travel',
  software: 'Software',
  equipment: 'Equipment',
  meals: 'Meals',
  subscriptions: 'Subscriptions',
  other: 'Other',
}

const CATEGORY_CLASSES: Record<ExpenseCategory, string> = {
  travel: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  software: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  equipment: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  meals: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  subscriptions: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200',
  other: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
}

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'billable', label: 'Billable' },
  { value: 'unbilled', label: 'Unbilled' },
  { value: 'billed', label: 'Billed' },
] as const

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string
    workstream_id?: string
    account_id?: string
    category?: string
    date_from?: string
    date_to?: string
  }>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const activeTab = resolved?.tab ?? 'all'

  const supabase = await createClient()

  const filters: ExpenseFilters = {}
  if (resolved?.workstream_id) filters.workstream_id = resolved.workstream_id
  if (resolved?.account_id) filters.account_id = resolved.account_id
  if (resolved?.category) filters.category = resolved.category as ExpenseCategory
  if (resolved?.date_from) filters.date_from = resolved.date_from
  if (resolved?.date_to) filters.date_to = resolved.date_to

  if (activeTab === 'billable') {
    filters.billable = true
  } else if (activeTab === 'unbilled') {
    filters.billable = true
    filters.billed = false
  } else if (activeTab === 'billed') {
    filters.billed = true
  }

  const [expenses, accounts, workstreams] = await Promise.all([
    getExpenses(filters, supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const totalBillable = expenses
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.amount), 0)
  const totalUnbilled = expenses
    .filter((e) => e.billable && !e.billed)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  function buildTabHref(tab: string) {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('tab', tab)
    if (resolved?.workstream_id) params.set('workstream_id', resolved.workstream_id)
    if (resolved?.account_id) params.set('account_id', resolved.account_id)
    if (resolved?.category) params.set('category', resolved.category)
    if (resolved?.date_from) params.set('date_from', resolved.date_from)
    if (resolved?.date_to) params.set('date_to', resolved.date_to)
    const qs = params.toString()
    return qs ? `/expenses?${qs}` : '/expenses'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Finance</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-50">Expenses</h1>
            <span className="rounded-full border border-slate-600/60 bg-slate-800/80 px-3 py-1 text-sm font-medium text-slate-200">
              Total {formatMoney(totalAmount)}
            </span>
            {totalBillable > 0 && (
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-200">
                Billable {formatMoney(totalBillable)}
              </span>
            )}
            {totalUnbilled > 0 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
                Unbilled {formatMoney(totalUnbilled)}
              </span>
            )}
          </div>
        </div>
        <Link
          href="/expenses/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Add expense
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const active = activeTab === tab.value
          return (
            <Link
              key={tab.value}
              href={buildTabHref(tab.value)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form className="flex flex-wrap gap-3">
          {activeTab !== 'all' && <input type="hidden" name="tab" value={activeTab} />}

          <select
            name="workstream_id"
            defaultValue={resolved?.workstream_id ?? ''}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All workstreams</option>
            {workstreams.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.label}
              </option>
            ))}
          </select>

          <select
            name="account_id"
            defaultValue={resolved?.account_id ?? ''}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          <select
            name="category"
            defaultValue={resolved?.category ?? ''}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="date_from"
            defaultValue={resolved?.date_from ?? ''}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <input
            type="date"
            name="date_to"
            defaultValue={resolved?.date_to ?? ''}
            className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />

          <button
            type="submit"
            className="rounded-2xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        {expenses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No expenses found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Workstream / Account</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3">Billable</th>
                  <th className="pb-3">Billed</th>
                  <th className="pb-3">Receipt</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const ws = workstreams.find((w) => w.id === expense.workstream_id) ?? null
                  const acc = accounts.find((a) => a.id === expense.account_id) ?? null

                  return (
                    <tr key={expense.id} className="border-t border-slate-800">
                      <td className="py-4 text-slate-300">{expense.date}</td>
                      <td className="py-4 font-medium text-slate-100">{expense.description}</td>
                      <td className="py-4">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${
                            CATEGORY_CLASSES[expense.category as ExpenseCategory] ??
                            CATEGORY_CLASSES.other
                          }`}
                        >
                          {CATEGORY_LABELS[expense.category as ExpenseCategory] ?? expense.category}
                        </span>
                      </td>
                      <td className="py-4">
                        {ws ? (
                          <WorkstreamBadge label={ws.label} slug={ws.slug} colour={ws.colour} />
                        ) : acc ? (
                          <span className="text-slate-300">{acc.name}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-4 text-right font-medium text-slate-100">
                        {formatMoney(Number(expense.amount))}
                      </td>
                      <td className="py-4">
                        {expense.billable ? (
                          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200">
                            Billable
                          </span>
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600" />
                        )}
                      </td>
                      <td className="py-4">
                        {expense.billed ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                            Billed
                          </span>
                        ) : expense.billable ? (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                            Unbilled
                          </span>
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600" />
                        )}
                      </td>
                      <td className="py-4">
                        {expense.receipt_url ? (
                          <a
                            href={expense.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-300 hover:text-sky-200"
                            title="View receipt"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                              <path d="M14 8H8" />
                              <path d="M16 12H8" />
                              <path d="M13 16H8" />
                            </svg>
                          </a>
                        ) : (
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-600" />
                        )}
                      </td>
                      <td className="py-4">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="text-sky-300 hover:text-sky-200"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
