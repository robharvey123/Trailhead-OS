'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import AccountForm from './AccountForm'
import ActivityTimeline from './ActivityTimeline'
import ProjectsSection from './ProjectsSection'
import QuickAddTask from './QuickAddTask'
import TouchpointTimeline from './TouchpointTimeline'
import DealForm from './DealForm'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import { formatTaskSchedule } from '@/lib/os'
import type {
  Activity,
  DealInput,
  DealStage,
  DealWithRelations,
  EmailThread,
  ProjectListItem,
  Tag,
  TimeEntry,
  Workstream,
} from '@/lib/types'
import type { AccountDetail } from '@/lib/db/accounts'

const TABS = [
  'Overview',
  'Emails',
  'Deals',
  'Tasks',
  'Projects',
  'Time',
  'Files',
  'Activity',
] as const
type TabName = (typeof TABS)[number]

const STATUS_LABEL: Record<string, string> = {
  prospect: 'Prospect', contacted: 'Contacted', active: 'Active', listed: 'Listed',
  declined: 'Declined', on_hold: 'On Hold', inactive: 'Inactive', archived: 'Archived',
}

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AccountDetailClient({
  initialAccount,
  workstreams,
  projects,
  initialActivities = [],
  deals: initialDeals,
  timeEntries,
  tags,
  emailThreads = [],
}: {
  initialAccount: AccountDetail
  workstreams: Workstream[]
  projects: ProjectListItem[]
  initialActivities?: Activity[]
  deals: DealWithRelations[]
  timeEntries: TimeEntry[]
  tags: Tag[]
  emailThreads?: EmailThread[]
}) {
  const router = useRouter()
  const [account, setAccount] = useState(initialAccount)
  const [tab, setTab] = useState<TabName>('Overview')
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(initialAccount.notes ?? '')
  const [deals, setDeals] = useState(initialDeals)
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(null)

  const openTasks = useMemo(() => account.recent_tasks.filter((t) => !t.completed_at), [account.recent_tasks])
  const completedTasks = useMemo(() => account.recent_tasks.filter((t) => t.completed_at), [account.recent_tasks])

  const timeTotals = useMemo(() => {
    let minutes = 0
    let amount = 0
    for (const e of timeEntries) {
      minutes += e.duration_minutes
      if (e.billable) amount += (e.duration_minutes / 60) * e.rate_snapshot
    }
    return { minutes, amount }
  }, [timeEntries])

  const contactOptions = useMemo(
    () => (account.contacts ?? []).map((c) => ({ id: c.id, name: c.name })),
    [account.contacts]
  )

  async function saveNotesOnBlur() {
    if ((account.notes ?? '') === notes) return
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save notes')
      setAccount((c) => ({ ...c, notes }))
    } catch {
      /* surfaced inline via field if needed */
    }
  }

  async function saveDeal(input: DealInput) {
    if (input.id) {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>(`/api/deals/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((d) => d.map((x) => (x.id === input.id ? { ...x, ...deal } : x)))
    } else {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((d) => [{ ...deal, account: { id: account.id, name: account.name } }, ...d])
    }
  }

  return (
    <div className="panel overflow-hidden">
      {/* header */}
      <div className="topbar">
        <Link href="/crm/accounts" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>
          ‹ CRM
        </Link>
        <span className="topbar-title">{account.name}</span>
        <span className={`status-badge status-${account.status}`}>{STATUS_LABEL[account.status] ?? account.status}</span>
        {account.channel ? <span className="channel-tag">{account.channel}</span> : null}
        <div className="topbar-actions">
          {!editing ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          ) : null}
        </div>
      </div>

      {/* tags row */}
      {tags.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '10px 24px', borderBottom: '1px solid var(--border)' }}>
          {tags.map((t) => (<span key={t.id} className={`tag-chip ${t.color}`}>{t.name}</span>))}
        </div>
      ) : null}

      {/* tabs */}
      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Deals' && deals.length ? ` (${deals.length})` : ''}
            {t === 'Time' && timeEntries.length ? ` (${timeEntries.length})` : ''}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {/* OVERVIEW */}
        {tab === 'Overview' ? (
          editing ? (
            <AccountForm
              workstreams={workstreams}
              initialAccount={account}
              onSaved={(updated) => {
                setAccount((c) => ({ ...c, ...updated }))
                setNotes(updated.notes ?? '')
                setEditing(false)
                router.refresh()
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
              <div className="card">
                <div className="panel-section-title">Account info</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Channel" value={account.channel} />
                  <Field label="Source" value={account.source} />
                  <Field label="Email" value={account.email_contact} mono />
                  <Field label="Industry" value={account.industry} />
                  <Field label="Website" value={account.website} mono />
                  <Field label="Size" value={account.size} />
                  <div style={{ gridColumn: '1/-1' }}>
                    <div className="field-label">HQ / Address</div>
                    <div className="field-value" style={{ whiteSpace: 'pre-wrap' }}>
                      {account.hq_address ||
                        [account.address_line1, account.address_line2, account.city, account.postcode, account.country].filter(Boolean).join('\n') ||
                        '—'}
                    </div>
                  </div>
                </div>
                <div className="panel-section-title" style={{ marginTop: 20 }}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotesOnBlur}
                  rows={6}
                  className="search-input"
                  style={{ width: '100%', paddingLeft: 12, resize: 'vertical' }}
                />
              </div>

              <div className="card">
                <div className="panel-section-title">
                  Contacts
                  <Link href={`/crm/contacts/new?account_id=${account.id}`} className="btn btn-ghost btn-sm">Add</Link>
                </div>
                {account.contacts?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {account.contacts.map((c) => (
                      <Link key={c.id} href={`/crm/contacts/${c.id}`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
                        <div className="td-name">{c.name}</div>
                        <div className="td-sub">{c.role ?? 'No role'}</div>
                        {c.email ? <div className="field-value mono" style={{ marginTop: 4, color: 'var(--accent)' }}>{c.email}</div> : null}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="field-label">No contacts linked.</p>
                )}
              </div>
            </div>
          )
        ) : null}

        {/* EMAILS */}
        {tab === 'Emails' ? (
          emailThreads.length === 0 ? (
            <div className="empty">
              No email threads linked to this account yet. New mail auto-links by contact/domain;
              you can also link threads from the <Link href="/inbox" className="acct-chip" style={{ display: 'inline-flex' }}>Inbox</Link>.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>From</th><th>Subject</th><th>When</th><th></th></tr>
              </thead>
              <tbody>
                {emailThreads.map((t) => (
                  <tr key={t.gmail_thread_id} style={{ cursor: 'pointer' }} onClick={() => router.push('/inbox')}>
                    <td className="td-name">{t.from_name}</td>
                    <td>
                      <div>{t.subject}</div>
                      <div className="td-sub">{t.snippet}</div>
                    </td>
                    <td className="td-mono">{fmtDate(t.last_at)}</td>
                    <td>{t.is_unread ? <span className="pill timer">unread</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {/* DEALS */}
        {tab === 'Deals' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingDeal(null); setDealFormOpen(true) }}>+ New deal</button>
            </div>
            {deals.length === 0 ? (
              <div className="empty">No deals for this account yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Stage</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ textAlign: 'right' }}>Prob.</th><th>Close</th></tr>
                </thead>
                <tbody>
                  {deals.map((d) => (
                    <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => { setEditingDeal(d); setDealFormOpen(true) }}>
                      <td className="td-name">{d.name}</td>
                      <td><span className={`status-badge ${stageClass(d.stage)}`}>{d.stage}</span></td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{d.value_amount != null ? formatCurrency(d.value_amount, d.value_currency || 'GBP') : '—'}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{d.probability}%</td>
                      <td className="td-mono">{fmtDate(d.expected_close_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* TASKS */}
        {tab === 'Tasks' ? (
          <div>
            <QuickAddTask
              workstream_id={account.workstream_id ?? null}
              account_id={account.id}
              placeholder="Add a task for this account..."
              onCreated={() => router.refresh()}
            />
            <div className="panel-section-title" style={{ marginTop: 16 }}>Open</div>
            {openTasks.length ? openTasks.map((t) => (
              <div key={t.id} className="card" style={{ marginBottom: 8 }}>
                <div className="td-name">{t.title}</div>
                <div className="td-sub">Due: {formatTaskSchedule(t.due_date, t.due_time)}</div>
              </div>
            )) : <p className="field-label">No open tasks.</p>}
            <div className="panel-section-title" style={{ marginTop: 16 }}>Completed</div>
            {completedTasks.length ? completedTasks.map((t) => (
              <div key={t.id} className="card" style={{ marginBottom: 8, opacity: 0.7 }}>
                <div className="td-name">{t.title}</div>
                <div className="td-sub">Completed {t.completed_at?.slice(0, 10)}</div>
              </div>
            )) : <p className="field-label">No completed tasks.</p>}
          </div>
        ) : null}

        {/* PROJECTS (reuses existing component) */}
        {tab === 'Projects' ? (
          <ProjectsSection
            title="Projects"
            description="Delivery work linked to this account."
            projects={projects}
            emptyMessage="No projects linked to this account yet."
            actionHref={`/projects/new?account_id=${account.id}`}
            actionLabel="New project"
          />
        ) : null}

        {/* TIME */}
        {tab === 'Time' ? (
          <div>
            {timeEntries.length === 0 ? (
              <div className="empty">No time logged against this account yet.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {timeEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="td-mono">{fmtDate(e.entry_date)}</td>
                      <td>{e.description ?? '—'}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{fmtMinutes(e.duration_minutes)}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{e.rate_snapshot ? formatCurrency(e.rate_snapshot, e.currency_snapshot || 'GBP') + '/h' : '—'}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{e.billable ? formatCurrency((e.duration_minutes / 60) * e.rate_snapshot, e.currency_snapshot || 'GBP') : '—'}</td>
                      <td><span className={`pill ${e.billable ? 'billable' : 'nonbill'}`}>{e.billable ? 'Billable' : 'Non-bill'}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="total-label" colSpan={2}>Total</td>
                    <td className="total-val" style={{ textAlign: 'right' }}>{fmtMinutes(timeTotals.minutes)}</td>
                    <td></td>
                    <td className="total-amount" style={{ textAlign: 'right' }}>{formatCurrency(timeTotals.amount, 'GBP')}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        ) : null}

        {/* FILES (placeholder) */}
        {tab === 'Files' ? (
          <div className="empty">
            File attachments (uploads + email attachments) will appear here once the Files/Gmail slice lands.
          </div>
        ) : null}

        {/* ACTIVITY (reuses existing components) */}
        {tab === 'Activity' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TouchpointTimeline
              initialTouchpoints={account.touchpoints}
              accountId={account.id}
              title="Touchpoints"
              description="Log calls, emails, messages, meetings, and notes."
            />
            <ActivityTimeline initialActivities={initialActivities} accountId={account.id} />
          </div>
        ) : null}
      </div>

      {dealFormOpen ? (
        <DealForm
          deal={editingDeal}
          accounts={[{ id: account.id, name: account.name }]}
          contacts={contactOptions}
          onClose={() => setDealFormOpen(false)}
          onSave={saveDeal}
        />
      ) : null}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className={`field-value ${mono ? 'mono' : ''}`}>{value || '—'}</div>
    </div>
  )
}

function stageClass(stage: DealStage) {
  switch (stage) {
    case 'Qualified': return 'status-prospect'
    case 'Proposal Sent': return 'status-contacted'
    case 'Negotiation': return 'status-contacted'
    case 'Won': return 'status-active'
    case 'Lost': return 'status-declined'
    case 'On Hold': return 'status-on_hold'
    default: return 'status-on_hold'
  }
}
