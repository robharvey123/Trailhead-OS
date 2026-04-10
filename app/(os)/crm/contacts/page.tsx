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
          <p className="text-xs uppercase tracking-[0.32em] text-white0">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Contacts</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Lead and client relationships across Trailhead OS.
          </p>
        </div>
        <Link
          href="/crm/contacts/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
        >
          New contact
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.75rem] border border-[#2A2A3A] bg-[#1A1A28] p-4 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search contacts"
          className="rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
        />
        <select
          name="account_id"
          defaultValue={accountId}
          className="rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
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
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
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
                  : 'border-[#2A2A3A] text-[#9CA3AF] hover:border-[#B8FF00]/40 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        {contacts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-10 text-center text-sm text-white0">
            No contacts match this view yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.2em] text-white0">
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
                    <tr key={contact.id} className="border-t border-[#2A2A3A]">
                      <td className="py-4">
                        <Link
                          href={`/crm/contacts/${contact.id}`}
                          className="font-medium text-white hover:text-white hover:underline"
                        >
                          {contact.name}
                        </Link>
                        <p className="mt-1 text-xs text-white0">
                          {contact.email ?? contact.phone ?? 'No email or phone'}
                        </p>
                      </td>
                      <td className="py-4 text-[#9CA3AF]">{account?.name ?? '—'}</td>
                      <td className="py-4">
                        {workstream ? (
                          <WorkstreamBadge
                            label={workstream.label}
                            slug={workstream.slug}
                            colour={workstream.colour}
                          />
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="py-4 text-[#9CA3AF]">{contact.role ?? '—'}</td>
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
