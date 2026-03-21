'use client'

import { useState } from 'react'
import Link from 'next/link'
import { currencySymbol } from '@/lib/format'
import type { CrmDeal } from '@/lib/crm/types'
import type { CrmActivity } from '@/lib/crm/types'
import { CRM_ACTIVITY_TYPE_LABELS, DEAL_STAGE_LABELS } from '@/lib/crm/types'
import type { InvoiceStatus } from '@/lib/finance/types'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/finance/types'

type DealInvoice = {
  id: string
  invoice_number: string
  status: InvoiceStatus
  total: number
  currency: string
  issue_date: string
  direction: string
}

const STAGES_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const

export default function DealDetailClient({
  workspaceId, deal, accountName, contactName, activities, invoices,
}: {
  workspaceId: string; deal: CrmDeal; accountName: string | null; contactName: string | null
  activities: CrmActivity[]; invoices: DealInvoice[]
}) {
  const [tab, setTab] = useState<'overview' | 'activities' | 'invoices'>('overview')
  const fmtCur = (v: number, code?: string) => `${currencySymbol(code || deal.currency || 'GBP')}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const currentStageIdx = STAGES_ORDER.indexOf(deal.stage as (typeof STAGES_ORDER)[number])

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/workspace/${workspaceId}/deals`} className="text-xs text-slate-400 hover:text-white">&larr; Back to deals</Link>
        <h1 className="mt-2 text-2xl font-semibold">{deal.title}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-slate-400">
          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">{DEAL_STAGE_LABELS[deal.stage] || deal.stage}</span>
          {accountName && <span>Account: {accountName}</span>}
          {contactName && <span>Contact: {contactName}</span>}
        </div>
      </div>

      {/* Stage progression */}
      <div className="flex items-center gap-1">
        {STAGES_ORDER.map((stage, idx) => {
          const isCurrent = stage === deal.stage
          const isPast = idx < currentStageIdx
          const isWon = stage === 'closed_won' && deal.stage === 'closed_won'
          const isLost = stage === 'closed_lost' && deal.stage === 'closed_lost'
          return (
            <div key={stage} className={`flex-1 h-2 rounded-full transition ${isWon ? 'bg-emerald-500' : isLost ? 'bg-rose-500' : isCurrent ? 'bg-blue-500' : isPast ? 'bg-blue-500/40' : 'bg-slate-700'}`} title={DEAL_STAGE_LABELS[stage]} />
          )
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Value</p>
          <p className="mt-1 text-xl font-semibold">{deal.value ? fmtCur(deal.value) : '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Probability</p>
          <p className="mt-1 text-xl font-semibold">{deal.probability}%</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Expected Close</p>
          <p className="mt-1 text-xl font-semibold">{deal.expected_close_date || '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Activities</p>
          <p className="mt-1 text-xl font-semibold">{activities.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800">
        {(['overview', 'activities', 'invoices'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm font-medium transition ${tab === t ? 'border-b-2 border-white text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'overview' ? 'Overview' : t === 'activities' ? `Activities (${activities.length})` : `Invoices (${invoices.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Stage</span><p>{DEAL_STAGE_LABELS[deal.stage]}</p></div>
              <div><span className="text-slate-500">Currency</span><p>{deal.currency}</p></div>
              <div><span className="text-slate-500">Expected Close</span><p>{deal.expected_close_date || '—'}</p></div>
              <div><span className="text-slate-500">Actual Close</span><p>{deal.actual_close_date || '—'}</p></div>
            </div>
            {deal.notes && <div><span className="text-xs text-slate-500">Notes</span><p className="mt-1 text-sm text-slate-300">{deal.notes}</p></div>}
            {deal.tags?.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {deal.tags.map((t) => <span key={t} className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{t}</span>)}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Activity</h3>
            {activities.length === 0 ? <p className="text-sm text-slate-500">No activities yet</p> : (
              activities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="text-xs rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{CRM_ACTIVITY_TYPE_LABELS[a.type]}</span>
                  <span className="truncate">{a.subject}</span>
                  <span className="ml-auto text-xs text-slate-500">{a.activity_date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div className="space-y-2">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No activities linked to this deal</p>
          ) : activities.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{CRM_ACTIVITY_TYPE_LABELS[a.type]}</span>
                <span className="font-medium">{a.subject}</span>
                <span className="ml-auto text-xs text-slate-500">{a.activity_date}</span>
              </div>
              {a.body && <p className="mt-2 text-sm text-slate-400">{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-slate-400">No invoices linked to this deal</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3"><Link href={`/workspace/${workspaceId}/invoices/${inv.id}`} className="text-blue-400 hover:underline">{inv.invoice_number}</Link></td>
                      <td className="px-4 py-3">{inv.issue_date}</td>
                      <td className="px-4 py-3 font-medium">{fmtCur(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold uppercase ${INVOICE_STATUS_COLORS[inv.status]}`}>{INVOICE_STATUS_LABELS[inv.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
