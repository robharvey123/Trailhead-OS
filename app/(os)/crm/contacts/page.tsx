import Link from 'next/link'
import StatusBadge from '@/components/os/StatusBadge'
import WorkstreamBadge from '@/components/os/WorkstreamBadge'
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
  searchParams?: Promise<{ status?: string; search?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const search = resolvedSearchParams?.search ?? ''
  const supabase = await createClient()
  const [contacts, workstreams] = await Promise.all([
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
      },
      supabase
    ).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
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

      <form className="flex flex-wrap gap-3 rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search contacts"
          className="min-w-[240px] flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
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
          <div className="space-y-3">
            {contacts.map((contact) => {
              const workstream =
                workstreams.find((item) => item.id === contact.workstream_id) ?? null

              return (
                <Link
                  key={contact.id}
                  href={`/crm/contacts/${contact.id}`}
                  className="block rounded-3xl border border-slate-800 bg-slate-950/70 p-5 transition hover:border-slate-600"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-100">{contact.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {contact.company ?? 'No company'} {contact.email ? `· ${contact.email}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={contact.status} kind="contact" />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {workstream ? (
                      <WorkstreamBadge
                        label={workstream.label}
                        slug={workstream.slug}
                        colour={workstream.colour}
                      />
                    ) : null}
                    {contact.role ? (
                      <span className="text-sm text-slate-400">{contact.role}</span>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
