'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import type { EngagementDetail, EngagementLinkCounts } from '@/lib/db/engagements'
import ConfirmDialog from '@/components/os/ConfirmDialog'
import EngagementForm from '@/components/os/engagements/EngagementForm'
import {
  APPROVAL_TYPE_LABELS,
  type ApprovalRequestWithRelations,
  type ApprovalType,
  type EngagementContributorWithPerson,
  type Person,
  type Tier1MilestoneWithAccount,
  type TimeEntry,
} from '@/lib/types'

type Named = { id: string; name: string }
const TABS = ['Overview', 'Time', 'Contributors', 'Tier 1', 'Milestones', 'Projects', 'Approvals', 'Weekly Updates', 'Documents'] as const
type Tab = (typeof TABS)[number]

const APPROVAL_STATUS_CLASS: Record<string, string> = {
  Open: 'status-contacted', Approved: 'status-active', Declined: 'status-declined', Withdrawn: 'status-on_hold',
}

const STATUS_CLASS: Record<string, string> = {
  Active: 'status-active', Draft: 'status-on_hold', Paused: 'status-contacted',
  Completed: 'status-listed', Terminated: 'status-declined',
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

type EngagementDoc = { id: string; type: string; title: string | null; week_start: string | null; created_at: string }

export default function EngagementDetailClient({
  detail,
  timeEntries,
  projects,
  accounts,
  documents = [],
  approvals: initialApprovals = [],
  linkCounts,
  contributors: initialContributors = [],
  people = [],
}: {
  detail: EngagementDetail
  timeEntries: TimeEntry[]
  projects: Array<{ id: string; name: string; status: string }>
  accounts: Named[]
  documents?: EngagementDoc[]
  approvals?: ApprovalRequestWithRelations[]
  linkCounts: EngagementLinkCounts
  contributors?: EngagementContributorWithPerson[]
  people?: Person[]
}) {
  const router = useRouter()
  const e = detail.engagement
  const [tab, setTab] = useState<Tab>('Overview')
  const [milestones, setMilestones] = useState<Tier1MilestoneWithAccount[]>(detail.tier1)
  const [error, setError] = useState('')
  const [addAccountId, setAddAccountId] = useState('')
  const [approvals, setApprovals] = useState<ApprovalRequestWithRelations[]>(initialApprovals)
  const [reqType, setReqType] = useState<ApprovalType>('hours_overage')
  const [reqAmount, setReqAmount] = useState('')
  const [reqDesc, setReqDesc] = useState('')
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Contributors
  const [contributors, setContributors] = useState<EngagementContributorWithPerson[]>(initialContributors)
  const [showAddContributor, setShowAddContributor] = useState(false)
  // Add-contributor modal fields. personPick = an existing people.id, or '__new__' to create one.
  const [personPick, setPersonPick] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [cRole, setCRole] = useState('')
  const [cRate, setCRate] = useState('')
  const [savingContributor, setSavingContributor] = useState(false)

  const contributorPersonIds = new Set(contributors.map((c) => c.person_id))
  const availablePeople = people.filter((p) => !contributorPersonIds.has(p.id))

  function resetContributorForm() {
    setPersonPick(''); setNewName(''); setNewEmail(''); setCRole(''); setCRate('')
  }

  async function submitContributor() {
    if (!personPick) { setError('Choose a person or create a new one.'); return }
    if (personPick === '__new__' && !newName.trim()) { setError('New person needs a name.'); return }
    setSavingContributor(true)
    setError('')
    try {
      let personId = personPick
      if (personPick === '__new__') {
        const { person } = await apiFetch<{ person: Person }>('/api/people', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: newName.trim(), email: newEmail.trim() || null, default_hourly_rate_gbp: cRate ? Number(cRate) : null }),
        })
        personId = person.id
      }
      const { contributor } = await apiFetch<{ contributor: EngagementContributorWithPerson }>(`/api/engagements/${e.id}/contributors`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId, role: cRole.trim() || null, hourly_rate_gbp: cRate ? Number(cRate) : 0 }),
      })
      setContributors((cs) => [...cs, contributor])
      setShowAddContributor(false)
      resetContributorForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contributor')
    } finally {
      setSavingContributor(false)
    }
  }

  async function patchContributor(id: string, patch: Record<string, unknown>) {
    try {
      const { contributor } = await apiFetch<{ contributor: EngagementContributorWithPerson }>(`/api/contributors/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      setContributors((cs) => cs.map((c) => (c.id === id ? { ...c, ...contributor, person: c.person } : c)))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update contributor') }
  }

  async function terminate() {
    setBusy(true)
    setError('')
    try {
      const today = new Date().toISOString().split('T')[0]
      await apiFetch(`/api/engagements/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate', end_date: today }),
      })
      setTerminateOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to terminate engagement')
    } finally {
      setBusy(false)
    }
  }

  async function doDelete() {
    setBusy(true)
    setError('')
    try {
      await apiFetch(`/api/engagements/${e.id}`, { method: 'DELETE' })
      router.push('/engagements')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete engagement')
      setBusy(false)
    }
  }

  // What a delete does, by FK rule: projects + time entries are unlinked (kept); the rest cascade-delete.
  const deleteItems = [
    `${linkCounts.projects} project${linkCounts.projects === 1 ? '' : 's'} — unlinked, kept`,
    `${linkCounts.timeEntries} time ${linkCounts.timeEntries === 1 ? 'entry' : 'entries'} — unlinked, kept`,
    `${linkCounts.milestones} Tier-1 milestone${linkCounts.milestones === 1 ? '' : 's'} — deleted`,
    `${linkCounts.approvals} approval request${linkCounts.approvals === 1 ? '' : 's'} — deleted`,
    `${linkCounts.documents} document${linkCounts.documents === 1 ? '' : 's'} — deleted`,
  ]

  async function createApprovalReq() {
    try {
      const { approval } = await apiFetch<{ approval: ApprovalRequestWithRelations }>('/api/approvals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagement_id: e.id, type: reqType, amount: reqAmount ? Number(reqAmount) : null, description: reqDesc || null }),
      })
      setApprovals((a) => [approval, ...a])
      setReqAmount(''); setReqDesc('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create approval') }
  }
  async function decideApprovalReq(id: string, action: 'approve' | 'decline' | 'withdraw') {
    try {
      const { approval } = await apiFetch<{ approval: ApprovalRequestWithRelations }>(`/api/approvals/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      setApprovals((a) => a.map((x) => (x.id === id ? { ...x, ...approval, approver: x.approver } : x)))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update approval') }
  }
  async function emailApprovalReq(id: string) {
    try {
      await apiFetch(`/api/approvals/${id}/send`, { method: 'POST' })
      setError('')
      alert('Approval request emailed to the approver.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to email approval') }
  }
  function requestOverage() {
    setReqType('hours_overage')
    setReqAmount(detail.hoursThisMonth.over > 0 ? detail.hoursThisMonth.over.toFixed(1) : '')
    setReqDesc(`Hours overage: ${detail.hoursThisMonth.over.toFixed(1)}h over the ${e.included_hours_monthly ?? '—'}h monthly cap.`)
    setTab('Approvals')
  }

  const hours = detail.hoursThisMonth
  const pct = hours.pct
  const barColor = pct > 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)'

  const summary = useMemo(() => {
    const completed = milestones.filter((m) => m.is_complete).length
    const uninvoiced = milestones
      .filter((m) => m.is_complete && !m.fee_invoice_id)
      .reduce((s, m) => s + (m.performance_fee ?? 0), 0)
    return { tracked: milestones.length, completed, uninvoiced }
  }, [milestones])

  async function refreshMilestone(updated: Tier1MilestoneWithAccount) {
    setMilestones((ms) => ms.map((m) => (m.id === updated.id ? { ...m, ...updated, account: m.account } : m)))
  }

  async function setDate(m: Tier1MilestoneWithAccount, field: string, value: string) {
    try {
      const { milestone } = await apiFetch<{ milestone: Tier1MilestoneWithAccount }>(`/api/milestones/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value || null }),
      })
      refreshMilestone(milestone)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update milestone') }
  }

  async function raiseInvoice(m: Tier1MilestoneWithAccount) {
    try {
      const { invoice } = await apiFetch<{ invoice: { id: string } }>(`/api/milestones/${m.id}/invoice`, { method: 'POST' })
      setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, fee_invoice_id: invoice.id } : x)))
      router.push(`/invoicing/${invoice.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to raise invoice') }
  }

  async function addTier1() {
    if (!addAccountId) return
    try {
      const { milestones: ms } = await apiFetch<{ milestones: Tier1MilestoneWithAccount[] }>(`/api/engagements/${e.id}/tier1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: addAccountId, performance_fee: e.performance_fee_default }),
      })
      setMilestones(ms)
      setAddAccountId('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add account') }
  }

  async function removeTier1(accountId: string) {
    try {
      await apiFetch(`/api/engagements/${e.id}/tier1?account_id=${accountId}`, { method: 'DELETE' })
      setMilestones((ms) => ms.filter((m) => m.account_id !== accountId))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove account') }
  }

  const dot = (set: boolean) => (
    <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', background: set ? 'var(--green)' : 'var(--surface-3)', marginRight: 4 }} />
  )

  const tier1AccountIds = new Set(milestones.map((m) => m.account_id))

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <Link href="/engagements" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Engagements</Link>
        <span className="topbar-title">{e.name}</span>
        <span className={`status-badge ${STATUS_CLASS[e.status] ?? 'status-on_hold'}`}>{e.status}</span>
        <span className="acct-pill matched">◈ {e.end_client?.name ?? 'End client'}</span>
        {e.billed_via && e.billed_via.id !== e.end_client_account_id ? <span className="acct-pill outbound">via {e.billed_via.name}</span> : null}
        <div className="topbar-actions">
          <span className="meta-chip">{e.retainer_amount_monthly != null ? `${formatCurrency(e.retainer_amount_monthly, e.currency)}/mo` : '—'}</span>
          <span className="meta-chip">{e.day_rate != null ? `${formatCurrency(e.day_rate, e.currency)}/day` : ''}</span>
          <span className="meta-chip">fee {e.performance_fee_default != null ? formatCurrency(e.performance_fee_default, e.currency) : '—'}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
            {menuOpen ? (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 41, minWidth: 210, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 28px rgba(0,0,0,0.16)', overflow: 'hidden', padding: 4 }}>
                  {e.status !== 'Terminated' ? (
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setTerminateOpen(true) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', borderRadius: 4, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = 'none')}
                    >
                      Terminate engagement
                    </button>
                  ) : null}
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', borderRadius: 4, fontSize: 13, color: 'var(--red)', cursor: 'pointer' }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = 'none')}
                  >
                    Delete engagement
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '6px 24px' }}>{error}</p> : null}

      <div style={{ padding: 24 }}>
        {/* OVERVIEW */}
        {tab === 'Overview' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
            <div className="card">
              <div className="panel-section-title">This month — hours</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="td-name">{hours.used.toFixed(1)}h / {hours.included ?? '—'}h</span>
                <span className="td-mono" style={{ color: barColor }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor }} />
              </div>
              {hours.over > (e.approval_thresholds?.hours_overage_hours ?? 0) ? (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ color: 'var(--red)', fontSize: 12 }}>{hours.over.toFixed(1)}h over cap — exceeds the {e.approval_thresholds?.hours_overage_hours ?? 0}h approval threshold.</p>
                  <button className="btn btn-ghost btn-sm" onClick={requestOverage}>Request approval</button>
                </div>
              ) : hours.over > 0 ? (
                <p style={{ color: 'var(--amber)', fontSize: 12, marginTop: 6 }}>{hours.over.toFixed(1)}h over the included {e.included_hours_monthly}h.</p>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="panel-section-title">Tier-1 milestones</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div className="stat-value" style={{ fontSize: 22 }}>{summary.tracked}</div><div className="field-label">tracked</div></div>
                  <div><div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{summary.completed}</div><div className="field-label">complete</div></div>
                  <div><div className="stat-value" style={{ fontSize: 22, color: 'var(--emerald)' }}>{formatCurrency(summary.uninvoiced, e.currency)}</div><div className="field-label">uninvoiced</div></div>
                </div>
              </div>
              <div className="card">
                <div className="panel-section-title">Quick actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/reports`}>Reports</Link>
                  <Link className="btn btn-ghost btn-sm" href={`/engagements/${e.id}/weekly-update/new`}>Generate weekly update</Link>
                  <Link className="btn btn-ghost btn-sm" href={`/engagements/${e.id}/tasks`}>Task board</Link>
                  <Link className="btn btn-ghost btn-sm" href={`/timesheet`}>+ Log time on this engagement</Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* TIME */}
        {tab === 'Time' ? (
          <div>
            {timeEntries.length === 0 ? <div className="empty">No time logged on this engagement yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th></th></tr></thead>
                <tbody>
                  {[...timeEntries]
                    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
                    .map((t) => (
                      <tr key={t.id}>
                        <td className="td-mono">{fmtDate(t.entry_date)}</td>
                        <td>{t.description ?? '—'}</td>
                        <td style={{ textAlign: 'right' }} className="td-mono">{fmtDur(t.duration_minutes)}</td>
                        <td><span className={`pill ${t.billable ? 'billable' : 'nonbill'}`}>{t.billable ? 'Billable' : 'Non-bill'}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* CONTRIBUTORS */}
        {tab === 'Contributors' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p className="field-label" style={{ margin: 0 }}>
                Rates are snapshotted per engagement — changing a person’s default rate later won’t affect these.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => { resetContributorForm(); setError(''); setShowAddContributor(true) }}>+ Add contributor</button>
            </div>
            {contributors.length === 0 ? <div className="empty">No contributors yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Person</th><th>Role</th><th style={{ textAlign: 'right' }}>Rate £/h</th><th>Active</th></tr></thead>
                <tbody>
                  {contributors.map((c) => (
                    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                      <td className="td-name">{c.person?.full_name ?? '—'}{c.person?.email ? <div className="td-sub">{c.person.email}</div> : null}</td>
                      <td>
                        <input className="filter-select" style={{ width: '100%' }} defaultValue={c.role ?? ''} placeholder="role"
                          onBlur={(ev) => { const v = ev.target.value.trim(); if (v !== (c.role ?? '')) patchContributor(c.id, { role: v || null }) }} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input type="number" className="filter-select" style={{ width: 90, textAlign: 'right' }} defaultValue={c.hourly_rate_gbp}
                          onBlur={(ev) => { const v = Number(ev.target.value); if (!Number.isNaN(v) && v !== c.hourly_rate_gbp) patchContributor(c.id, { hourly_rate_gbp: v }) }} />
                      </td>
                      <td>
                        <input type="checkbox" checked={c.is_active} onChange={(ev) => patchContributor(c.id, { is_active: ev.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* TIER 1 */}
        {tab === 'Tier 1' ? (
          <div>
            <div className="filterbar" style={{ padding: '0 0 12px', border: 'none', background: 'none' }}>
              <select className="filter-select" value={addAccountId} onChange={(ev) => setAddAccountId(ev.target.value)}>
                <option value="">Add account…</option>
                {accounts.filter((a) => !tier1AccountIds.has(a.id)).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addTier1} disabled={!addAccountId}>+ Add to Tier 1</button>
            </div>
            {milestones.length === 0 ? <div className="empty">No Tier-1 accounts yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Account</th><th>Channel</th><th>Milestone</th><th style={{ textAlign: 'right' }}>Fee</th><th>Invoice</th><th></th></tr></thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <td className="td-name">{m.account?.name ?? '—'}</td>
                      <td>{m.account?.channel ? <span className="channel-tag">{m.account.channel}</span> : '—'}</td>
                      <td>
                        {dot(!!m.range_review_decided_at)}{dot(!!m.go_live_confirmed_at)}{dot(!!m.first_po_received_at)}
                        {m.is_complete ? <span className="pill billable" style={{ marginLeft: 6 }}>complete</span> : null}
                      </td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{m.performance_fee != null ? formatCurrency(m.performance_fee, e.currency) : '—'}</td>
                      <td>{m.fee_invoice_id ? <span className="pill billable">invoiced</span> : m.is_complete ? <span className="pill timer">due</span> : <span className="td-mono">—</span>}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => removeTier1(m.account_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* MILESTONES */}
        {tab === 'Milestones' ? (
          milestones.length === 0 ? <div className="empty">Add Tier-1 accounts first.</div> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {milestones.map((m) => (
                <div className="card" key={m.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="td-name">{m.account?.name ?? '—'}</span>
                    {m.is_complete && !m.fee_invoice_id ? (
                      <button className="btn btn-primary btn-sm" onClick={() => raiseInvoice(m)}>Raise {formatCurrency(m.performance_fee ?? 0, e.currency)} invoice</button>
                    ) : m.fee_invoice_id ? <Link className="btn btn-ghost btn-sm" href={`/invoicing/${m.fee_invoice_id}`}>View invoice</Link> : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {([['range_review_decided_at', 'Range review decided'], ['go_live_confirmed_at', 'Go-live confirmed'], ['first_po_received_at', 'First PO received']] as const).map(([field, lbl]) => (
                      <div key={field}>
                        <label className="field-label">{lbl}</label>
                        <input type="date" className="filter-select" style={{ width: '100%' }} value={(m[field] as string | null) ?? ''} onChange={(ev) => setDate(m, field, ev.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {/* PROJECTS */}
        {tab === 'Projects' ? (
          projects.length === 0 ? <div className="empty">No projects linked. Link projects from /settings/engagements or the project page.</div> : (
            <table className="data-table">
              <thead><tr><th>Project</th><th>Status</th></tr></thead>
              <tbody>{projects.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/records/${p.id}`)}>
                  <td className="td-name">{p.name}</td><td className="td-mono">{p.status}</td>
                </tr>
              ))}</tbody>
            </table>
          )
        ) : null}

        {/* APPROVALS */}
        {tab === 'Approvals' ? (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="panel-section-title">Request approval</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Type</label>
                  <select className="filter-select" style={{ width: '100%' }} value={reqType} onChange={(ev) => setReqType(ev.target.value as ApprovalType)}>
                    {(Object.keys(APPROVAL_TYPE_LABELS) as ApprovalType[]).map((t) => (<option key={t} value={t}>{APPROVAL_TYPE_LABELS[t]}</option>))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Amount ({e.currency})</label>
                  <input type="number" className="filter-select" style={{ width: '100%' }} value={reqAmount} onChange={(ev) => setReqAmount(ev.target.value)} placeholder="optional" />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="field-label">Detail</label>
                <input className="filter-select" style={{ width: '100%' }} value={reqDesc} onChange={(ev) => setReqDesc(ev.target.value)} placeholder="What needs approving and why" />
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button className="btn btn-primary btn-sm" onClick={createApprovalReq}>Submit request</button>
              </div>
            </div>

            {approvals.length === 0 ? <div className="empty">No approval requests yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Type</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td className="td-name">{APPROVAL_TYPE_LABELS[a.type]}{a.description ? <div className="td-sub">{a.description}</div> : null}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{a.amount != null ? formatCurrency(a.amount, a.currency) : '—'}</td>
                      <td><span className={`status-badge ${APPROVAL_STATUS_CLASS[a.status] ?? 'status-on_hold'}`}>{a.status}</span>{a.decision_notes ? <div className="td-sub">{a.decision_notes}</div> : null}</td>
                      <td className="td-mono">{fmtDate(a.requested_at)}</td>
                      <td>
                        {a.status === 'Open' ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => emailApprovalReq(a.id)}>✉ Email</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => decideApprovalReq(a.id, 'approve')} style={{ color: 'var(--green)' }}>Approve</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => decideApprovalReq(a.id, 'decline')} style={{ color: 'var(--red)' }}>Decline</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => decideApprovalReq(a.id, 'withdraw')}>Withdraw</button>
                          </div>
                        ) : a.gmail_thread_id ? <Link className="btn btn-ghost btn-sm" href="/inbox">View thread</Link> : <span className="td-mono">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* WEEKLY UPDATES */}
        {tab === 'Weekly Updates' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/weekly-update/new`}>Generate this week’s update</Link>
            </div>
            {documents.filter((d) => d.type === 'weekly_update').length === 0 ? (
              <div className="empty">No weekly updates generated yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Title</th><th>Week of</th><th>Created</th></tr></thead>
                <tbody>
                  {documents.filter((d) => d.type === 'weekly_update').map((d) => (
                    <tr key={d.id}>
                      <td className="td-name">{d.title ?? 'Weekly update'}</td>
                      <td className="td-mono">{d.week_start ? fmtDate(d.week_start) : '—'}</td>
                      <td className="td-mono">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* DOCUMENTS */}
        {tab === 'Documents' ? (
          documents.length === 0 ? (
            <div className="empty">Engagement documents (weekly updates, Annex A/B, Tier-1 sub-schedule, signed copies) will live here.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Title</th><th>Type</th><th>Created</th></tr></thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="td-name">{d.title ?? '—'}</td>
                    <td><span className="channel-tag">{d.type}</span></td>
                    <td className="td-mono">{fmtDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(15,23,42,0.45)]"
          style={{ padding: '40px 16px' }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) setEditing(false) }}
        >
          <EngagementForm
            accounts={accounts}
            initial={e}
            onCancel={() => setEditing(false)}
            onSaved={() => { setEditing(false); router.refresh() }}
          />
        </div>
      ) : null}

      {showAddContributor ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          style={{ background: 'rgba(15,23,42,0.45)', padding: '60px 16px' }}
          onClick={(ev) => { if (ev.target === ev.currentTarget) setShowAddContributor(false) }}
        >
          <div className="panel" style={{ width: '100%', maxWidth: 460, padding: 20 }}>
            <div className="panel-section-title">Add contributor</div>
            <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
              <div>
                <label className="field-label">Person</label>
                <select className="filter-select" style={{ width: '100%' }} value={personPick} onChange={(ev) => setPersonPick(ev.target.value)}>
                  <option value="">Choose…</option>
                  {availablePeople.map((p) => (<option key={p.id} value={p.id}>{p.full_name}{p.email ? ` · ${p.email}` : ''}</option>))}
                  <option value="__new__">➕ Create new person…</option>
                </select>
              </div>
              {personPick === '__new__' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label className="field-label">Full name *</label><input className="filter-select" style={{ width: '100%' }} value={newName} onChange={(ev) => setNewName(ev.target.value)} /></div>
                  <div><label className="field-label">Email</label><input className="filter-select" style={{ width: '100%' }} value={newEmail} onChange={(ev) => setNewEmail(ev.target.value)} placeholder="optional" /></div>
                </div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label className="field-label">Role</label><input className="filter-select" style={{ width: '100%' }} value={cRole} onChange={(ev) => setCRole(ev.target.value)} placeholder="e.g. Engineer" /></div>
                <div><label className="field-label">Rate £/h *</label><input type="number" className="filter-select" style={{ width: '100%' }} value={cRate} onChange={(ev) => setCRate(ev.target.value)} placeholder="0 for volunteer" /></div>
              </div>
              {error ? <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p> : null}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddContributor(false)} disabled={savingContributor}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={submitContributor} disabled={savingContributor}>{savingContributor ? 'Adding…' : 'Add contributor'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title="Terminate engagement?"
        description={`This sets ${e.name} to Terminated with an end date of today. All time, milestones, approvals and documents are kept — you can still view the engagement. This does not delete anything.`}
        confirmLabel="Terminate"
        variant="warning"
        loading={busy}
        onConfirm={terminate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete engagement?"
        description={`Permanently delete ${e.name}. Projects and time entries are unlinked but kept; milestones, approval requests and documents are deleted.`}
        banner={
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-2)' }}>
            <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>ⓘ</span>
            <span>
              Most of the time, use <strong style={{ color: 'var(--text)' }}>Terminate</strong> instead — it keeps everything (milestones, approvals, documents, invoices). Delete is for engagements created by mistake (test data, duplicates).
            </span>
          </div>
        }
        confirmLabel="Delete engagement"
        variant="destructive"
        items={deleteItems}
        itemsLabel="What happens to linked records"
        confirmPhrase={e.name}
        confirmPhraseLabel={`Type the engagement name to confirm`}
        loading={busy}
        onConfirm={doDelete}
      />
    </div>
  )
}
