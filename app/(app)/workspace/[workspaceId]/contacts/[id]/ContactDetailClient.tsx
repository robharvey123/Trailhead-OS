'use client'

import { useState } from 'react'
import Link from 'next/link'
import { currencySymbol } from '@/lib/format'
import type { CrmContact, CrmDeal, CrmActivity } from '@/lib/crm/types'
import { DEAL_STAGE_LABELS, CRM_ACTIVITY_TYPE_LABELS } from '@/lib/crm/types'

const ACTIVITY_ICONS: Record<string, string> = { call: '📞', email: '✉️', meeting: '🤝', note: '📝', task: '✅' }

export default function ContactDetailClient({
  workspaceId, contact, accountName, deals, activities,
}: {
  workspaceId: string; contact: CrmContact; accountName: string | null
  deals: CrmDeal[]; activities: CrmActivity[]
}) {
  const [tab, setTab] = useState<'overview' | 'deals' | 'activities'>('overview')

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/workspace/${workspaceId}/contacts`} className="text-xs text-slate-400 hover:text-white">&larr; Back to contacts</Link>
        <h1 className="mt-2 text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
          {contact.job_title && <span>{contact.job_title}</span>}
          {accountName && (
            <Link href={`/workspace/${workspaceId}/accounts/${contact.account_id}`} className="text-blue-400 hover:underline">{accountName}</Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Deals</p>
          <p className="mt-1 text-xl font-semibold">{deals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pipeline Value</p>
          <p className="mt-1 text-xl font-semibold">
            {deals.length > 0
              ? `${currencySymbol(deals[0].currency || 'GBP')}${deals.reduce((s, d) => s + (d.value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Activities</p>
          <p className="mt-1 text-xl font-semibold">{activities.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Account</p>
          <p className="mt-1 text-xl font-semibold truncate">{accountName || '—'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800">
        {(['overview', 'deals', 'activities'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium transition ${tab === t ? 'border-b-2 border-white text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'overview' ? 'Overview' : t === 'deals' ? `Deals (${deals.length})` : `Activities (${activities.length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Contact Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email</span><p>{contact.email || '—'}</p></div>
              <div><span className="text-slate-500">Phone</span><p>{contact.phone || '—'}</p></div>
              <div><span className="text-slate-500">Job Title</span><p>{contact.job_title || '—'}</p></div>
              <div><span className="text-slate-500">Department</span><p>{contact.department || '—'}</p></div>
              <div><span className="text-slate-500">Primary Contact</span><p>{contact.is_primary ? 'Yes' : 'No'}</p></div>
            </div>
            {contact.notes && <div><span className="text-xs text-slate-500">Notes</span><p className="mt-1 text-sm text-slate-300">{contact.notes}</p></div>}
            {contact.brands?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {contact.brands.map((b) => <span key={b} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{b}</span>)}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Activity</h3>
            {activities.length === 0 ? <p className="text-sm text-slate-500">No activities yet</p> : (
              activities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span>{ACTIVITY_ICONS[a.type] || '📋'}</span>
                  <span className="truncate">{a.subject}</span>
                  <span className="ml-auto text-xs text-slate-500">{a.activity_date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'deals' && (
        <div className="space-y-2">
          {deals.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No deals linked to this contact</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">Deal</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Probability</th>
                    <th className="px-4 py-3">Expected Close</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {deals.map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3"><Link href={`/workspace/${workspaceId}/deals/${d.id}`} className="text-blue-400 hover:underline">{d.title}</Link></td>
                      <td className="px-4 py-3"><span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">{DEAL_STAGE_LABELS[d.stage]}</span></td>
                      <td className="px-4 py-3 font-medium">{d.value ? `${currencySymbol(d.currency)}${d.value.toLocaleString()}` : '—'}</td>
                      <td className="px-4 py-3">{d.probability}%</td>
                      <td className="px-4 py-3 text-slate-400">{d.expected_close_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'activities' && (
        <div className="space-y-2">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No activities for this contact</p>
          ) : activities.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2">
                <span>{ACTIVITY_ICONS[a.type] || '📋'}</span>
                <span className="text-xs rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{CRM_ACTIVITY_TYPE_LABELS[a.type]}</span>
                <span className="font-medium">{a.subject}</span>
                <span className="ml-auto text-xs text-slate-500">{a.activity_date}</span>
              </div>
              {a.body && <p className="mt-2 text-sm text-slate-400">{a.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
