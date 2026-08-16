'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import ConfirmDialog from './ConfirmDialog'
import {
  type DealForecastBucket,
  type DealInput,
  type DealStage,
  type DealWithRelations,
} from '@/lib/types'
import Modal from '@/components/ui/Modal'
import DealKanban from './DealKanban'
import DealForm from './DealForm'
import StageBadge from './StageBadge'

interface DealsClientProps {
  initialDeals: DealWithRelations[]
  accounts: Array<{ id: string; name: string }>
  projects?: Array<{ id: string; name: string }>
}

type View = 'kanban' | 'table'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function DealsClient({ initialDeals, accounts, projects = [] }: DealsClientProps) {
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals)
  const [view, setView] = useState<View>('kanban')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DealWithRelations | null>(null)
  const [showForecast, setShowForecast] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')
  const [error, setError] = useState('')
  // Stage moves are optimistic and silent on screen, so the outcome is mirrored
  // into a polite live region for screen readers.
  const [statusMessage, setStatusMessage] = useState('')
  // Deleting a deal is irreversible and carries pipeline value, so it is gated
  // behind a type-to-confirm dialog rather than firing straight from the click.
  const [pendingDelete, setPendingDelete] = useState<DealWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Map submitted project_ids back to {id,name} so chips render without a refetch.
  function resolveProjects(ids?: string[]): Array<{ id: string; name: string }> {
    return (ids ?? [])
      .map((id) => projectsById.get(id))
      .filter((p): p is { id: string; name: string } => Boolean(p))
  }

  const visibleDeals = useMemo(
    () =>
      projectFilter
        ? deals.filter((d) => d.projects?.some((p) => p.id === projectFilter))
        : deals,
    [deals, projectFilter]
  )

  const openTotal = useMemo(
    () =>
      deals
        .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
        .reduce((sum, d) => sum + (d.value_amount ?? 0), 0),
    [deals]
  )
  const weightedTotal = useMemo(
    () =>
      deals
        .filter((d) => d.stage !== 'Won' && d.stage !== 'Lost')
        .reduce((sum, d) => sum + (d.value_amount ?? 0) * (d.probability / 100), 0),
    [deals]
  )

  async function handleMove(dealId: string, stage: DealStage) {
    const target = deals.find((d) => d.id === dealId)
    if (!target || target.stage === stage) return
    const previous = deals
    setError('')
    setStatusMessage('')
    setDeals((current) => current.map((d) => (d.id === dealId ? { ...d, stage } : d)))
    try {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      setDeals((current) =>
        current.map((d) => (d.id === dealId ? { ...d, ...deal, account: d.account } : d))
      )
      setStatusMessage(`${target.name} moved to ${stage}.`)
    } catch (err) {
      setDeals(previous)
      const message = err instanceof Error ? err.message : 'Failed to move deal'
      setError(message)
      toast.error(message)
    }
  }

  async function handleSave(input: DealInput) {
    const linkedProjects = resolveProjects(input.project_ids)
    if (input.id) {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>(`/api/deals/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((current) =>
        current.map((d) =>
          d.id === input.id
            ? {
                ...d,
                ...deal,
                account: deal.account ?? { id: deal.account_id, name: accountName.get(deal.account_id) ?? d.account?.name ?? '' },
                projects: deal.projects ?? linkedProjects,
              }
            : d
        )
      )
    } else {
      const { deal } = await apiFetch<{ deal: DealWithRelations }>('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      setDeals((current) => [
        {
          ...deal,
          account: deal.account ?? { id: deal.account_id, name: accountName.get(deal.account_id) ?? '' },
          projects: deal.projects ?? linkedProjects,
        },
        ...current,
      ])
    }
  }

  /** DealForm's Delete button routes here — it requests confirmation, it does not delete. */
  async function requestDelete(id: string) {
    const target = deals.find((d) => d.id === id)
    if (target) setPendingDelete(target)
  }

  /** Re-create a just-deleted deal from its own field values. */
  async function restoreDeal(deal: DealWithRelations) {
    try {
      const { deal: created } = await apiFetch<{ deal: DealWithRelations }>('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: deal.account_id,
          primary_contact_id: deal.primary_contact_id ?? null,
          name: deal.name,
          stage: deal.stage,
          value_amount: deal.value_amount,
          value_currency: deal.value_currency,
          probability: deal.probability,
          expected_close_date: deal.expected_close_date,
          source: deal.source ?? null,
          notes: deal.notes ?? null,
          project_ids: (deal.projects ?? []).map((p) => p.id),
        } satisfies DealInput),
      })
      setDeals((current) => [
        { ...created, account: created.account ?? deal.account, projects: created.projects ?? deal.projects },
        ...current,
      ])
      toast.success(`Restored ${deal.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not restore ${deal.name}`)
    }
  }

  async function confirmDelete() {
    const target = pendingDelete
    // In-flight guard: without it a double-press fires two DELETEs, and the
    // second one's 404 restores the already-deleted row to the board.
    if (!target || deleting) return
    setDeleting(true)
    const previous = deals
    setDeals((current) => current.filter((d) => d.id !== target.id))
    setFormOpen(false)
    setEditing(null)
    try {
      await apiFetch(`/api/deals/${target.id}`, { method: 'DELETE' })
      toast.success(`Deleted ${target.name}`, {
        description: `${formatCurrency(target.value_amount ?? 0, 'GBP')} removed from the pipeline.`,
        action: { label: 'Undo', onClick: () => void restoreDeal(target) },
        duration: 10000,
      })
      setPendingDelete(null)
    } catch (err) {
      setDeals(previous)
      const message = err instanceof Error ? err.message : 'Failed to delete deal'
      setError(message)
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(deal: DealWithRelations) {
    setEditing(deal)
    setFormOpen(true)
  }

  const forecast = useMemo<DealForecastBucket[]>(() => {
    const buckets = new Map<string, DealForecastBucket>()
    for (const d of deals) {
      if (d.stage === 'Won' || d.stage === 'Lost' || !d.expected_close_date) continue
      const month = d.expected_close_date.slice(0, 7)
      const bucket = buckets.get(month) ?? {
        month,
        deal_count: 0,
        total_value: 0,
        weighted_value: 0,
      }
      const value = d.value_amount ?? 0
      bucket.deal_count += 1
      bucket.total_value += value
      bucket.weighted_value += value * (d.probability / 100)
      buckets.set(month, bucket)
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 6)
  }, [deals])

  const toggleBtn = (target: View, label: string) => (
    <button
      type="button"
      onClick={() => setView(target)}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        view === target ? 'bg-[var(--accent-dim)] text-[color:var(--accent-strong)]' : 'text-[color:var(--text-2)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="os-page-title">Deals</h1>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">
            Open pipeline {formatCurrency(openTotal, 'GBP')} · weighted{' '}
            {formatCurrency(weightedTotal, 'GBP')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] p-1">
            {toggleBtn('kanban', 'Kanban')}
            {toggleBtn('table', 'Table')}
          </div>
          {projects.length > 0 ? (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() => setShowForecast(true)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-2 text-sm text-[color:var(--text-2)] hover:bg-[var(--surface-2)]"
          >
            Forecast
          </button>
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            + New deal
          </button>
        </div>
      </div>

      {/* Live regions stay mounted (and out of flow) so a later change is
          actually announced rather than appearing already-populated. */}
      <p role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
      <p role="alert" aria-live="assertive" className="sr-only">
        {error}
      </p>
      {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      {view === 'kanban' ? (
        <DealKanban deals={visibleDeals} onMove={handleMove} onSelect={openEdit} />
      ) : (
        <div className="os-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-2)]">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3">Projects</th>
                <th scope="col" className="px-4 py-3">Stage</th>
                <th scope="col" className="px-4 py-3 text-right">Value</th>
                <th scope="col" className="px-4 py-3 text-right">Prob.</th>
                <th scope="col" className="px-4 py-3 text-right">Weighted</th>
                <th scope="col" className="px-4 py-3">Close</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[color:var(--text-3)]">
                    {projectFilter ? 'No deals linked to this project.' : 'No deals yet. Create your first deal.'}
                  </td>
                </tr>
              ) : (
                visibleDeals.map((d) => (
                  // Same trick as globals.css `.row-link`, but the deal opens a
                  // panel rather than a URL, so the stretched ::after hangs off a
                  // real <button> in the name cell instead of an <a>.
                  <tr
                    key={d.id}
                    className="relative cursor-pointer border-b border-[color:var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                  >
                    <td className="px-4 py-3 font-medium text-[color:var(--text)]">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        className="text-left after:absolute after:inset-0 after:content-['']"
                      >
                        {d.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-2)]">{d.account?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {d.projects && d.projects.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {d.projects.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex rounded-full bg-[var(--accent-dim)] px-2 py-0.5 text-xs font-medium text-[color:var(--accent-strong)]"
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[color:var(--text-3)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={d.stage} />
                    </td>
                    <td className="px-4 py-3 text-right text-[color:var(--text)]">
                      {d.value_amount != null ? formatCurrency(d.value_amount, d.value_currency || 'GBP') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[color:var(--text-2)]">{d.probability}%</td>
                    <td className="px-4 py-3 text-right text-[color:var(--text-2)]">
                      {d.value_amount != null
                        ? formatCurrency(d.value_amount * (d.probability / 100), d.value_currency || 'GBP')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--text-2)]">{formatDate(d.expected_close_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <DealForm
          deal={editing}
          accounts={accounts}
          projects={projects}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          onDelete={editing ? requestDelete : undefined}
        />
      ) : null}

      <Modal
        open={showForecast}
        onClose={() => setShowForecast(false)}
        title="Weighted forecast — next 6 months"
        closeLabel="Close forecast"
        overlayClassName="p-4"
        panelClassName="w-full max-w-lg rounded-2xl border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="os-section-title">Weighted forecast — next 6 months</h2>
          <button
            onClick={() => setShowForecast(false)}
            aria-label="Close forecast"
            className="text-[color:var(--text-2)] hover:text-[color:var(--text)]"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">
          value × probability, bucketed by expected close. Excludes Won/Lost.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-2)]">
            <tr>
              <th scope="col" className="py-2">Month</th>
              <th scope="col" className="py-2 text-right">Deals</th>
              <th scope="col" className="py-2 text-right">Total</th>
              <th scope="col" className="py-2 text-right">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {forecast.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[color:var(--text-3)]">
                  No deals with an expected close date.
                </td>
              </tr>
            ) : (
              forecast.map((b) => (
                <tr key={b.month} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="py-2 text-[color:var(--text)]">{b.month}</td>
                  <td className="py-2 text-right text-[color:var(--text-2)]">{b.deal_count}</td>
                  <td className="py-2 text-right text-[color:var(--text-2)]">
                    {formatCurrency(b.total_value, 'GBP')}
                  </td>
                  <td className="py-2 text-right font-medium text-[color:var(--text)]">
                    {formatCurrency(b.weighted_value, 'GBP')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete deal?'}
        description={
          pendingDelete
            ? `This permanently removes the deal and its ${formatCurrency(
                pendingDelete.value_amount ?? 0,
                'GBP'
              )} from your pipeline, along with its stage history. You can undo this immediately after, but not later.`
            : ''
        }
        confirmLabel="Delete deal"
        variant="destructive"
        loading={deleting}
        confirmPhrase={pendingDelete?.name}
        confirmPhraseLabel="Type the deal name to confirm"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
