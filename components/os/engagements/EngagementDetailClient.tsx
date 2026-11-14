'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import { formatDate } from '@/lib/documents/format'
import { formatBillingPeriod } from '@/lib/engagements/periods'
import DocumentPreviewDrawer from '@/components/os/engagements/DocumentPreviewDrawer'
import type { EngagementDetail, EngagementLinkCounts } from '@/lib/db/engagements'
import type { EngagementTouchpoint } from '@/lib/db/touchpoints'
import PageHeader from '@/components/ui/PageHeader'
import ConfirmDialog from '@/components/os/ConfirmDialog'
import EngagementForm from '@/components/os/engagements/EngagementForm'
import TouchpointTimeline from '@/components/os/TouchpointTimeline'
import TimeLedger from '@/components/time/TimeLedger'
import StartTimerButton from '@/components/time/StartTimerButton'
import LogTimeButton from '@/components/time/LogTimeButton'
import WhatsAppTimeline from '@/components/os/WhatsAppTimeline'
import type { WhatsAppConversationWithMessages } from '@/lib/types'
import {
  APPROVAL_TYPE_LABELS,
  ENGAGEMENT_STATUSES,
  type ApprovalRequestWithRelations,
  type ApprovalType,
  type EngagementContributorWithPerson,
  type EngagementStatus,
  type Person,
  type Tier1MilestoneWithAccount,
  type TimeEntryLedgerRow,
} from '@/lib/types'

type Named = { id: string; name: string }
const TABS = ['Overview', 'Time', 'Timeline', 'Contributors', 'Tier 1', 'Milestones', 'Projects', 'Approvals', 'Weekly Updates', 'Documents'] as const
type Tab = (typeof TABS)[number]

const APPROVAL_STATUS_CLASS: Record<string, string> = {
  Open: 'status-contacted', Approved: 'status-active', Declined: 'status-declined', Withdrawn: 'status-on_hold',
}

const STATUS_CLASS: Record<string, string> = {
  Active: 'status-active', Draft: 'status-on_hold', Paused: 'status-contacted',
  Completed: 'status-listed', Terminated: 'status-declined',
}

// Delegates to the shared formatter, which handles both date-only values
// (week_start) and full timestamps (created_at) without rendering "Invalid Date".
const fmtDate = formatDate

/** Days from today (UTC) to a date-only string; positive = future. */
function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null
  const today = new Date().toISOString().slice(0, 10)
  return Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

type EngagementDoc = { id: string; type: string; title: string | null; week_start: string | null; created_at: string; file_path: string | null; file_name: string | null; mime_type: string | null; size_bytes: number | null }

function fmtBytes(n: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

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
  touchpoints = [],
  whatsappConversations = [],
}: {
  detail: EngagementDetail
  timeEntries: TimeEntryLedgerRow[]
  projects: Array<{ id: string; name: string; status: string }>
  accounts: Named[]
  documents?: EngagementDoc[]
  approvals?: ApprovalRequestWithRelations[]
  linkCounts: EngagementLinkCounts
  contributors?: EngagementContributorWithPerson[]
  people?: Person[]
  touchpoints?: EngagementTouchpoint[]
  whatsappConversations?: WhatsAppConversationWithMessages[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const e = detail.engagement
  // /engagements/[id]?tab=Time&period=2026-08-15 deep-links a billing month
  // (the hours-by-engagement report links here).
  const initialTab = (TABS as readonly string[]).includes(searchParams.get('tab') ?? '') ? (searchParams.get('tab') as Tab) : 'Overview'
  const initialPeriod = searchParams.get('period')
  const [tab, setTab] = useState<Tab>(initialTab)
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
  const [uploading, setUploading] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<EngagementDoc | null>(null)

  async function uploadDoc(file: File) {
    setError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/engagements/${e.id}/documents`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function deleteDoc(docId: string) {
    setError('')
    try {
      const res = await fetch(`/api/engagements/${e.id}/documents/${docId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

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

  // Change status directly. Pause/resume go through the dedicated actions (they
  // also stamp/clear dates); Terminated has its own dialog (it needs an end date).
  async function changeStatus(next: EngagementStatus) {
    setBusy(true)
    setError('')
    try {
      const body =
        next === 'Paused' ? { action: 'pause' } :
        next === 'Active' ? { action: 'resume' } :
        { status: next }
      await apiFetch(`/api/engagements/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change status')
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
    setReqDesc(`Hours overage: ${detail.hoursThisMonth.over.toFixed(1)}h over the ${e.included_hours_monthly ?? '—'}h monthly cap (${formatBillingPeriod(detail.hoursThisMonth.period, { year: true })}).`)
    setTab('Approvals')
  }

  const hours = detail.hoursThisMonth
  const pct = hours.pct
  // The bar is always brand blue on its track; the status reads from the figure beside it.
  // `!` because `.td-num` sets its own colour outside a cascade layer.
  const pctTone = pct > 100 ? 'text-[var(--red-strong)]!' : pct >= 80 ? 'text-[var(--amber-strong)]!' : 'text-[var(--green-strong)]!'

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
    <span className={`mr-1 inline-block h-[9px] w-[9px] rounded-pill ${set ? 'bg-[var(--green)]' : 'bg-[var(--surface-3)]'}`} />
  )

  const tier1AccountIds = new Set(milestones.map((m) => m.account_id))

  const menuItem = 'block w-full cursor-pointer rounded-control border-none bg-transparent px-2.5 py-2 text-left text-[13px] enabled:hover:bg-[var(--surface-2)]'

  return (
    <>
    <PageHeader
      back={{ href: '/engagements', label: 'Engagements' }}
      title={e.name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className={`status-badge ${STATUS_CLASS[e.status] ?? 'status-on_hold'}`}>{e.status}</span>
          <span className="acct-pill matched">◈ {e.end_client?.name ?? 'End client'}</span>
          {e.billed_via && e.billed_via.id !== e.end_client_account_id ? <span className="acct-pill outbound">via {e.billed_via.name}</span> : null}
          <span className="meta-chip">{e.retainer_amount_monthly != null ? `${formatCurrency(e.retainer_amount_monthly, e.currency)}/mo` : '—'}</span>
          <span className="meta-chip">{e.day_rate != null ? `${formatCurrency(e.day_rate, e.currency)}/day` : ''}</span>
          <span className="meta-chip">fee {e.performance_fee_default != null ? formatCurrency(e.performance_fee_default, e.currency) : '—'}</span>
        </span>
      }
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <div className="relative">
            <button className="btn btn-ghost btn-sm" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>⋯</button>
            {menuOpen ? (
              <>
                <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40" />
                <div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-[41] min-w-[210px] overflow-hidden rounded-control border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]">
                  <div className="os-label px-2.5 pb-1 pt-1.5">Set status</div>
                  {ENGAGEMENT_STATUSES.filter((s) => s !== e.status && s !== 'Terminated').map((s) => (
                    <button
                      key={s}
                      role="menuitem"
                      disabled={busy}
                      onClick={() => { setMenuOpen(false); void changeStatus(s) }}
                      className={`${menuItem} text-[var(--text)]`}
                    >
                      {s}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-[var(--border)]" />
                  {e.status !== 'Terminated' ? (
                    <button
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); setTerminateOpen(true) }}
                      className={`${menuItem} text-[var(--text)]`}
                    >
                      Terminate engagement
                    </button>
                  ) : null}
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setDeleteOpen(true) }}
                    className={`${menuItem} text-[var(--red-strong)]`}
                  >
                    Delete engagement
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </>
      }
    />
    <div className="panel overflow-hidden">
      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {error ? <p className="px-6 py-1.5 text-xs text-[var(--red-strong)]">{error}</p> : null}

      <div className="p-6">
        {/* OVERVIEW */}
        {tab === 'Overview' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="card">
              <div className="panel-section-title">Billing month hours · {formatBillingPeriod(hours.period)}</div>
              <div className="mb-1.5 flex justify-between">
                <span className="td-name">{hours.used.toFixed(1)}h / {hours.included ?? '—'}h</span>
                <span className={`td-num ${pctTone}`}>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-pill bg-[var(--surface-3)]">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              {hours.over > (e.approval_thresholds?.hours_overage_hours ?? 0) ? (
                <div className="mt-2 flex items-center gap-2.5">
                  <p className="text-xs text-[var(--red-strong)]">{hours.over.toFixed(1)}h over cap — exceeds the {e.approval_thresholds?.hours_overage_hours ?? 0}h approval threshold.</p>
                  <button className="btn btn-ghost btn-sm" onClick={requestOverage}>Request approval</button>
                </div>
              ) : hours.over > 0 ? (
                <p className="mt-1.5 text-xs text-[var(--amber-strong)]">{hours.over.toFixed(1)}h over the included {e.included_hours_monthly}h.</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-4">
              <div className="card">
                <div className="panel-section-title">Tier-1 milestones</div>
                <div className="flex gap-4">
                  <div><div className="stat-value">{summary.tracked}</div><div className="field-label">tracked</div></div>
                  <div><div className="stat-value">{summary.completed}</div><div className="field-label">complete</div></div>
                  <div><div className="stat-value">{formatCurrency(summary.uninvoiced, e.currency)}</div><div className="field-label">uninvoiced</div></div>
                </div>
              </div>
              <div className="card">
                <div className="panel-section-title">Term &amp; renewal</div>
                <div className="mt-1 flex justify-between">
                  <span className="field-label">Term</span>
                  <span className="td-num">{fmtDate(e.start_date)} → {fmtDate(e.end_date)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="field-label">Notice due</span>
                  <span className="td-num">{e.notice_date ? fmtDate(e.notice_date) : e.notice_period_days ? '—' : 'no notice period set'}</span>
                </div>
                {(() => {
                  const days = daysUntil(e.notice_date)
                  if (days === null) return null
                  if (days < 0) {
                    return <p className={`mt-1.5 text-xs ${e.auto_renews ? 'text-[var(--amber-strong)]' : 'text-[var(--text-3)]'}`}>
                      Notice date passed{e.auto_renews ? ` — auto-renews for ${e.renewal_term_months ?? 12} months` : ''}.
                    </p>
                  }
                  if (days <= 45) {
                    return <p className={`mt-1.5 text-xs ${days <= 14 ? 'text-[var(--red-strong)]' : 'text-[var(--amber-strong)]'}`}>
                      Notice due in {days} day{days === 1 ? '' : 's'}{days <= 14 ? ' — act now' : ''}.
                    </p>
                  }
                  return null
                })()}
                {e.auto_renews ? <p className="mt-1.5 text-[11px] text-[var(--text-3)]">Auto-renews for {e.renewal_term_months ?? 12}-month terms.</p> : null}
              </div>
              <div className="card">
                <div className="panel-section-title">Quick actions</div>
                <p className="mb-2.5 text-xs text-[var(--text-3)]">
                  Last interaction:{' '}
                  {touchpoints[0]
                    ? `${touchpoints[0].type} — ${touchpoints[0].subject} (${fmtDate(touchpoints[0].occurred_at.slice(0, 10))})`
                    : 'none logged'}
                </p>
                <div className="flex flex-col gap-2">
                  <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/reports`}>Reports</Link>
                  <Link className="btn btn-ghost btn-sm" href={`/engagements/${e.id}/tasks`}>Task board</Link>
                  <StartTimerButton engagementId={e.id} accountId={e.end_client_account_id} />
                  <LogTimeButton engagementId={e.id} label="+ Log time on this engagement" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* TIME — the shared ledger: billing-month grouping, filters, inline logging. */}
        {tab === 'Time' ? (
          <TimeLedger
            rows={timeEntries}
            scope={{ engagement_id: e.id }}
            engagement={{
              id: e.id,
              code: e.code ?? null,
              name: e.name,
              included_hours_monthly: e.included_hours_monthly,
              end_client_account_id: e.end_client_account_id,
              start_date: e.start_date,
              billing_month_start_day: e.billing_month_start_day ?? 1,
            }}
            hoursThisMonth={detail.hoursThisMonth}
            initialPeriod={initialPeriod}
          />
        ) : null}

        {/* CONTRIBUTORS */}
        {tab === 'Contributors' ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="m-0 text-xs text-[var(--text-3)]">
                Rates are snapshotted per engagement — changing a person’s default rate later won’t affect these.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => { resetContributorForm(); setError(''); setShowAddContributor(true) }}>+ Add contributor</button>
            </div>
            {contributors.length === 0 ? <div className="empty">No contributors yet.</div> : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Person</th><th>Role</th><th className="text-right!">Rate £/h</th><th>Active</th></tr></thead>
                <tbody>
                  {contributors.map((c) => (
                    <tr key={c.id} className={c.is_active ? undefined : 'opacity-50'}>
                      <td className="td-name">{c.person?.full_name ?? '—'}{c.person?.email ? <div className="td-sub">{c.person.email}</div> : null}</td>
                      <td>
                        <input className="filter-select w-full" defaultValue={c.role ?? ''} placeholder="role"
                          onBlur={(ev) => { const v = ev.target.value.trim(); if (v !== (c.role ?? '')) patchContributor(c.id, { role: v || null }) }} />
                      </td>
                      <td className="text-right">
                        <input type="number" className="filter-select w-[90px] text-right" defaultValue={c.hourly_rate_gbp}
                          onBlur={(ev) => { const v = Number(ev.target.value); if (!Number.isNaN(v) && v !== c.hourly_rate_gbp) patchContributor(c.id, { hourly_rate_gbp: v }) }} />
                      </td>
                      <td>
                        <input type="checkbox" checked={c.is_active} onChange={(ev) => patchContributor(c.id, { is_active: ev.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}

        {/* TIER 1 */}
        {tab === 'Tier 1' ? (
          <div>
            <div className="flex flex-wrap items-center gap-2.5 pb-3">
              <select className="filter-select" value={addAccountId} onChange={(ev) => setAddAccountId(ev.target.value)}>
                <option value="">Add account…</option>
                {accounts.filter((a) => !tier1AccountIds.has(a.id)).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addTier1} disabled={!addAccountId}>+ Add to Tier 1</button>
            </div>
            {milestones.length === 0 ? <div className="empty">No Tier-1 accounts yet.</div> : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Account</th><th>Channel</th><th>Milestone</th><th className="text-right!">Fee</th><th>Invoice</th><th></th></tr></thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <td className="td-name">{m.account?.name ?? '—'}</td>
                      <td>{m.account?.channel ? <span className="channel-tag">{m.account.channel}</span> : '—'}</td>
                      <td>
                        {dot(!!m.range_review_decided_at)}{dot(!!m.go_live_confirmed_at)}{dot(!!m.first_po_received_at)}
                        {m.is_complete ? <span className="pill billable ml-1.5">complete</span> : null}
                      </td>
                      <td className="td-num text-right">{m.performance_fee != null ? formatCurrency(m.performance_fee, e.currency) : '—'}</td>
                      <td>{m.fee_invoice_id ? <span className="pill billable">invoiced</span> : m.is_complete ? <span className="pill timer">due</span> : <span className="td-num">—</span>}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => removeTier1(m.account_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}

        {/* MILESTONES */}
        {tab === 'Milestones' ? (
          milestones.length === 0 ? <div className="empty">Add Tier-1 accounts first.</div> : (
            <div className="grid gap-3">
              {milestones.map((m) => (
                <div className="card" key={m.id}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="td-name">{m.account?.name ?? '—'}</span>
                    {m.is_complete && !m.fee_invoice_id ? (
                      <button className="btn btn-primary btn-sm" onClick={() => raiseInvoice(m)}>Raise {formatCurrency(m.performance_fee ?? 0, e.currency)} invoice</button>
                    ) : m.fee_invoice_id ? <Link className="btn btn-ghost btn-sm" href={`/invoicing/${m.fee_invoice_id}`}>View invoice</Link> : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {([['range_review_decided_at', 'Range review decided'], ['go_live_confirmed_at', 'Go-live confirmed'], ['first_po_received_at', 'First PO received']] as const).map(([field, lbl]) => (
                      <div key={field}>
                        <label className="field-label">{lbl}</label>
                        <input type="date" className="filter-select w-full" value={(m[field] as string | null) ?? ''} onChange={(ev) => setDate(m, field, ev.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {/* PROJECTS */}
        {tab === 'Timeline' ? (
          <div className="flex flex-col gap-5">
            <TouchpointTimeline
              initialTouchpoints={touchpoints}
              engagementId={e.id}
              title="Interactions"
              description="Calls, emails and meetings on this engagement."
            />
            <WhatsAppTimeline conversations={whatsappConversations} engagementId={e.id} accountId={e.end_client_account_id} />
          </div>
        ) : null}

        {tab === 'Projects' ? (
          projects.length === 0 ? <div className="empty">No projects linked. Link projects from /settings/engagements or the project page.</div> : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Project</th><th>Status</th></tr></thead>
              <tbody>{projects.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => router.push(`/projects/records/${p.id}`)}>
                  <td className="td-name">{p.name}</td><td className="td-num">{p.status}</td>
                </tr>
              ))}</tbody>
            </table>
            </div>
          )
        ) : null}

        {/* APPROVALS */}
        {tab === 'Approvals' ? (
          <div>
            <div className="card mb-4">
              <div className="panel-section-title">Request approval</div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="field-label">Type</label>
                  <select className="filter-select w-full" value={reqType} onChange={(ev) => setReqType(ev.target.value as ApprovalType)}>
                    {(Object.keys(APPROVAL_TYPE_LABELS) as ApprovalType[]).map((t) => (<option key={t} value={t}>{APPROVAL_TYPE_LABELS[t]}</option>))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Amount ({e.currency})</label>
                  <input type="number" className="filter-select w-full" value={reqAmount} onChange={(ev) => setReqAmount(ev.target.value)} placeholder="optional" />
                </div>
              </div>
              <div className="mt-2.5">
                <label className="field-label">Detail</label>
                <input className="filter-select w-full" value={reqDesc} onChange={(ev) => setReqDesc(ev.target.value)} placeholder="What needs approving and why" />
              </div>
              <div className="mt-2.5 text-right">
                <button className="btn btn-primary btn-sm" onClick={createApprovalReq}>Submit request</button>
              </div>
            </div>

            {approvals.length === 0 ? <div className="empty">No approval requests yet.</div> : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Type</th><th className="text-right!">Amount</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead>
                <tbody>
                  {approvals.map((a) => (
                    <tr key={a.id}>
                      <td className="td-name">{APPROVAL_TYPE_LABELS[a.type]}{a.description ? <div className="td-sub">{a.description}</div> : null}</td>
                      <td className="td-num text-right">{a.amount != null ? formatCurrency(a.amount, a.currency) : '—'}</td>
                      <td><span className={`status-badge ${APPROVAL_STATUS_CLASS[a.status] ?? 'status-on_hold'}`}>{a.status}</span>{a.decision_notes ? <div className="td-sub">{a.decision_notes}</div> : null}</td>
                      <td className="td-num">{fmtDate(a.requested_at)}</td>
                      <td>
                        {a.status === 'Open' ? (
                          <div className="flex flex-wrap gap-1">
                            <button className="btn btn-ghost btn-sm" onClick={() => emailApprovalReq(a.id)}>✉ Email</button>
                            <button className="btn btn-ghost btn-sm text-[var(--green-strong)]!" onClick={() => decideApprovalReq(a.id, 'approve')}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => decideApprovalReq(a.id, 'decline')}>Decline</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => decideApprovalReq(a.id, 'withdraw')}>Withdraw</button>
                          </div>
                        ) : a.gmail_thread_id ? <Link className="btn btn-ghost btn-sm" href="/inbox">View thread</Link> : <span className="td-num">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}

        {/* WEEKLY UPDATES */}
        {tab === 'Weekly Updates' ? (
          <div>
            <div className="mb-3 flex justify-end">
              <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/reports`}>Generate weekly report</Link>
            </div>
            {documents.filter((d) => d.type === 'weekly_update').length === 0 ? (
              <div className="empty">No weekly updates generated yet.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Title</th><th>Week of</th><th>Created</th></tr></thead>
                <tbody>
                  {documents.filter((d) => d.type === 'weekly_update').map((d) => (
                    <tr key={d.id}>
                      <td className="td-name">{d.title ?? 'Weekly update'}</td>
                      <td className="td-num">{d.week_start ? fmtDate(d.week_start) : '—'}</td>
                      <td className="td-num">{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}

        {/* DOCUMENTS */}
        {tab === 'Documents' ? (
          <div>
            <div className="mb-3.5 flex flex-wrap items-center gap-3">
              <label className={`btn btn-primary btn-sm ${uploading ? 'cursor-default! opacity-60' : ''}`}>
                {uploading ? 'Uploading…' : '＋ Upload document'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0]
                    if (file) uploadDoc(file)
                    ev.target.value = '' // allow re-selecting the same file
                  }}
                />
              </label>
              <span className="td-num">PDF, Word, Excel, images — up to 25 MB.</span>
            </div>

            {documents.length === 0 ? (
              <div className="empty">No documents yet. Upload signed copies, Annex A/B, Tier-1 sub-schedules — anything for this engagement.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Title</th><th>Type</th><th>Size</th><th>Created</th><th className="text-right!"></th></tr></thead>
                <tbody>
                  {documents.map((d) => (
                    <tr
                      key={d.id}
                      onClick={d.file_path ? () => setPreviewDoc(d) : undefined}
                      className={d.file_path ? 'cursor-pointer' : undefined}
                      title={d.file_path ? 'Click to preview' : undefined}
                    >
                      <td className="td-name">{d.title ?? d.file_name ?? (d.file_path ? 'Untitled' : '—')}</td>
                      <td><span className="channel-tag">{d.type}</span></td>
                      <td className="td-num">{fmtBytes(d.size_bytes)}</td>
                      <td className="td-num">{fmtDate(d.created_at)}</td>
                      <td className="text-right" onClick={(ev) => ev.stopPropagation()}>
                        {d.file_path ? (
                          <a
                            href={`/api/engagements/${e.id}/documents/${d.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm mr-1"
                          >
                            Download
                          </a>
                        ) : null}
                        <button className="btn btn-danger btn-sm" onClick={() => deleteDoc(d.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {editing ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[var(--navy)]/45 px-4 py-10"
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
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--navy)]/45 px-4 py-[60px]"
          onClick={(ev) => { if (ev.target === ev.currentTarget) setShowAddContributor(false) }}
        >
          <div className="panel w-full max-w-[460px] p-5">
            <div className="panel-section-title">Add contributor</div>
            <div className="mt-2 grid gap-3">
              <div>
                <label className="field-label">Person</label>
                <select className="filter-select w-full" value={personPick} onChange={(ev) => setPersonPick(ev.target.value)}>
                  <option value="">Choose…</option>
                  {availablePeople.map((p) => (<option key={p.id} value={p.id}>{p.full_name}{p.email ? ` · ${p.email}` : ''}</option>))}
                  <option value="__new__">➕ Create new person…</option>
                </select>
              </div>
              {personPick === '__new__' ? (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div><label className="field-label">Full name *</label><input className="filter-select w-full" value={newName} onChange={(ev) => setNewName(ev.target.value)} /></div>
                  <div><label className="field-label">Email</label><input className="filter-select w-full" value={newEmail} onChange={(ev) => setNewEmail(ev.target.value)} placeholder="optional" /></div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div><label className="field-label">Role</label><input className="filter-select w-full" value={cRole} onChange={(ev) => setCRole(ev.target.value)} placeholder="e.g. Engineer" /></div>
                <div><label className="field-label">Rate £/h *</label><input type="number" className="filter-select w-full" value={cRate} onChange={(ev) => setCRate(ev.target.value)} placeholder="0 for volunteer" /></div>
              </div>
              {error ? <p className="m-0 text-xs text-[var(--red-strong)]">{error}</p> : null}
              <div className="flex justify-end gap-2">
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
          <div className="flex gap-2 rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[12.5px] leading-[1.45] text-[var(--text-2)]">
            <span aria-hidden className="shrink-0 font-bold text-[var(--accent-strong)]">ⓘ</span>
            <span>
              Most of the time, use <strong className="text-[var(--text)]">Terminate</strong> instead — it keeps everything (milestones, approvals, documents, invoices). Delete is for engagements created by mistake (test data, duplicates).
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

      <DocumentPreviewDrawer engagementId={e.id} doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
    </>
  )
}
