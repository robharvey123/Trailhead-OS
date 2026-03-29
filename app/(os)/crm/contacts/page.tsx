import Link from 'next/link'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

const CONTACT_TABS = [
  { value: 'all', label: 'All' },
  { value: 'lead', label: 'Lead' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
] as const

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; search?: string; account_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const search = resolvedSearchParams?.search ?? ''
  const accountId = resolvedSearchParams?.account_id ?? ''
  const supabase = await createClient()
  const [contacts, workstreams, accounts] = await Promise.all([
    getContacts(
      {
        status:
          activeStatus === 'lead' ||
          activeStatus === 'active' ||
          activeStatus === 'inactive' ||
          activeStatus === 'archived'
            ? activeStatus
            : undefined,
        search: search || undefined,
        account_id: accountId || undefined,
      },
      supabase
    ).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Contacts</h1>
          <p className="mt-2 text-sm text-slate-400">
            Lead and client relationships across Trailhead OS.
          </p>
        </div>
        <Link
          href="/crm/contacts/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          New contact
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search contacts"
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
        <select
          name="account_id"
          defaultValue={accountId}
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {CONTACT_TABS.map((tab) => {
          const params = new URLSearchParams()
          if (tab.value !== 'all') {
            params.set('status', tab.value)
          }
          if (search) {
            params.set('search', search)
          }
          if (accountId) {
            params.set('account_id', accountId)
          }

          const href = params.toString() ? `/crm/contacts?${params}` : '/crm/contacts'
          const active = activeStatus === tab.value
          return (
            <Link
              key={tab.value}
              href={href}
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

      <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
        {contacts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
            No contacts match this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Account</th>
                  <th className="pb-3">Workstream</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const workstream =
                    workstreams.find((item) => item.id === contact.workstream_id) ?? null
                  const account =
                    accounts.find((item) => item.id === contact.account_id) ?? null

                  return (
                    <tr key={contact.id} className="border-t border-slate-800">
                      <td className="py-4">
                        <Link
                          href={`/crm/contacts/${contact.id}`}
                          className="font-medium text-slate-100 hover:text-white hover:underline"
                        >
                          {contact.name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {contact.email ?? contact.phone ?? 'No email or phone'}
                        </p>
                      </td>
                      <td className="py-4 text-slate-300">{account?.name ?? '—'}</td>
                      <td className="py-4">
                        {workstream ? (
                          <WorkstreamBadge
                            label={workstream.label}
                            slug={workstream.slug}
                            colour={workstream.colour}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 text-slate-300">{contact.role ?? '—'}</td>
                      <td className="py-4">
                        <StatusBadge status={contact.status} kind="contact" />
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
