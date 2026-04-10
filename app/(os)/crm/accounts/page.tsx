import Link from 'next/link'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { AccountStatus } from '@/lib/types'

const ACCOUNT_TABS: Array<{ value: 'all' | AccountStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; search?: string; workstream_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const search = resolvedSearchParams?.search ?? ''
  const workstreamId = resolvedSearchParams?.workstream_id ?? ''
  const supabase = await createClient()

  const [accounts, workstreams] = await Promise.all([
    getAccounts(
      {
        status:
          activeStatus === 'prospect' ||
          activeStatus === 'active' ||
          activeStatus === 'inactive' ||
          activeStatus === 'archived'
            ? activeStatus
            : undefined,
        search: search || undefined,
        workstream_id: workstreamId || undefined,
      },
      supabase
    ).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-white0">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Accounts <span className="text-white0">({accounts.length})</span>
          </h1>
        </div>
        <Link
          href="/crm/accounts/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
        >
          New account
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.75rem] border border-[#2A2A3A] bg-[#1A1A28] p-4 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by name or website"
          className="rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
        />
        <select
          name="workstream_id"
          defaultValue={workstreamId}
          className="rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
        >
          <option value="">All workstreams</option>
          {workstreams.map((workstream) => (
            <option key={workstream.id} value={workstream.id}>
              {workstream.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {ACCOUNT_TABS.map((tab) => {
          const params = new URLSearchParams()
          if (tab.value !== 'all') {
            params.set('status', tab.value)
          }
          if (search) {
            params.set('search', search)
          }
          if (workstreamId) {
            params.set('workstream_id', workstreamId)
          }

          const href = params.toString() ? `/crm/accounts?${params}` : '/crm/accounts'
          const active = activeStatus === tab.value

          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-[#2A2A3A] text-[#9CA3AF] hover:border-[#B8FF00]/40 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        {accounts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-10 text-center text-sm text-white0">
            No accounts match this view yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-white0">
              <tr>
                <th className="pb-3">Name</th>
                <th className="pb-3">Industry</th>
                <th className="pb-3">Workstream</th>
                <th className="pb-3 text-right">Contacts</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[#2A2A3A]">
                  <td className="py-4">
                    <Link
                      href={`/crm/accounts/${account.id}`}
                      className="font-medium text-white hover:text-white hover:underline"
                    >
                      {account.name}
                    </Link>
                    {account.website ? (
                      <p className="mt-1 text-xs text-white0">{account.website}</p>
                    ) : null}
                  </td>
                  <td className="py-4 text-[#9CA3AF]">{account.industry ?? '—'}</td>
                  <td className="py-4">
                    {account.workstream ? (
                      <WorkstreamBadge
                        label={account.workstream.label}
                        slug={account.workstream.label}
                        colour={account.workstream.colour}
                      />
                    ) : (
                      <span className="text-[#9CA3AF]">—</span>
                    )}
                  </td>
                  <td className="py-4 text-right text-[#9CA3AF]">{account.contacts_count}</td>
                  <td className="py-4">
                    <StatusBadge status={account.status} kind="account" />
                  </td>
                  <td className="py-4 text-[#9CA3AF]">
                    {new Date(account.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
