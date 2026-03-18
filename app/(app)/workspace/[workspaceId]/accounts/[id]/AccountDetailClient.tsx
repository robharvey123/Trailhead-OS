'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CrmAccount, CrmContact, CrmDeal, CrmActivity } from '@/lib/crm/types'
import { CRM_ACCOUNT_TYPE_LABELS, DEAL_STAGE_LABELS } from '@/lib/crm/types'
import ActivityTimeline from '@/components/crm/ActivityTimeline'

type Tab = 'overview' | 'contacts' | 'deals' | 'activity'

const fmtCurrency = (v: number | null) => v != null ? `$${v.toLocaleString()}` : '—'

export default function AccountDetailClient({
  workspaceId,
  account,
  contacts,
  deals,
  activities,
}: {
  workspaceId: string
  account: CrmAccount
  contacts: CrmContact[]
  deals: CrmDeal[]
  activities: CrmActivity[]
}) {
  const [tab, setTab] = useState<Tab>('overview')

  const pipelineValue = deals
    .filter((d) => !d.stage.startsWith('closed_'))
    .reduce((sum, d) => sum + (d.value || 0), 0)

  const wonValue = deals
    .filter((d) => d.stage === 'closed_won')
    .reduce((sum, d) => sum + (d.value || 0), 0)

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: 'Contacts', count: contacts.length },
    { key: 'deals', label: 'Deals', count: deals.length },
    { key: 'activity', label: 'Activity', count: activities.length },
  ]

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/workspace/${workspaceId}/accounts`}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        ← All Accounts
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-300">
            {CRM_ACCOUNT_TYPE_LABELS[account.type]}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-400">
          {account.industry && <span>{account.industry}</span>}
          {account.email && <span>{account.email}</span>}
          {account.phone && <span>{account.phone}</span>}
          {account.website && <span>{account.website}</span>}
          {(account.city || account.country) && (
            <span>{[account.city, account.state, account.country].filter(Boolean).join(', ')}</span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Contacts', value: contacts.length.toString() },
          { label: 'Active Deals', value: deals.filter((d) => !d.stage.startsWith('closed_')).length.toString() },
          { label: 'Pipeline', value: fmtCurrency(pipelineValue) },
          { label: 'Won', value: fmtCurrency(wonValue) },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm transition ${
              tab === t.key
                ? 'border-b-2 border-white text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {account.notes && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Notes</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{account.notes}</p>
            </div>
          )}
          {account.tags?.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {account.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent contacts preview */}
          {contacts.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">Contacts</h3>
                <button onClick={() => setTab('contacts')} className="text-[11px] text-slate-500 hover:text-white">
                  View all →
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {contacts.slice(0, 3).map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                    <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                    {c.job_title && <p className="text-xs text-slate-500">{c.job_title}</p>}
                    {c.email && <p className="mt-1 text-xs text-slate-400">{c.email}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent deals preview */}
          {deals.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">Deals</h3>
                <button onClick={() => setTab('deals')} className="text-[11px] text-slate-500 hover:text-white">
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {deals.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                        {DEAL_STAGE_LABELS[d.stage]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">{fmtCurrency(d.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Primary</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No contacts for this account</td></tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.job_title || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{c.phone || '—'}</td>
                    <td className="px-4 py-3">{c.is_primary ? '★' : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deals' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Close Date</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No deals for this account</td></tr>
              ) : (
                deals.map((d) => (
                  <tr key={d.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium">{d.title}</td>
                    <td className="px-4 py-3 text-emerald-400">{fmtCurrency(d.value)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs">
                        {DEAL_STAGE_LABELS[d.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{d.probability}%</td>
                    <td className="px-4 py-3 text-slate-400">{d.expected_close_date || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'activity' && (
        <ActivityTimeline
          workspaceId={workspaceId}
          initialActivities={activities}
          accountId={account.id}
        />
      )}
    </div>
  )
}
