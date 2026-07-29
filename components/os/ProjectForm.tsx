'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Account, Project, ProjectStatus } from '@/lib/types'
import ConfirmDialog from './ConfirmDialog'
import EntityCombobox from './EntityCombobox'
import EngagementPicker, { type EngagementOption } from '@/components/projects/EngagementPicker'

const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]

export default function ProjectForm({
  accounts,
  engagements = [],
  initialProject = null,
  initialValues,
  cancelHref = '/projects',
}: {
  accounts: Account[]
  engagements?: EngagementOption[]
  initialProject?: Project | null
  initialValues?: {
    account_id?: string
    engagement_id?: string
    name?: string
    description?: string
    brief?: string
  }
  cancelHref?: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: initialProject?.name ?? initialValues?.name ?? '',
    account_id: initialProject?.account_id ?? initialValues?.account_id ?? '',
    engagement_id: initialProject?.engagement_id ?? initialValues?.engagement_id ?? '',
    status: initialProject?.status ?? ('planning' as ProjectStatus),
    start_date: initialProject?.start_date ?? '',
    end_date: initialProject?.end_date ?? '',
    estimated_end_date: initialProject?.estimated_end_date ?? '',
    hourly_rate: initialProject?.hourly_rate ?? '',
    description: initialProject?.description ?? initialValues?.description ?? '',
    brief: initialProject?.brief ?? initialValues?.brief ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
        meta: account.website ?? account.industry ?? null,
      })),
    [accounts]
  )

  async function handleSave() {
    // Engagement is required when creating (mirrors the roadmap-import guard).
    if (!initialProject && !form.engagement_id) {
      setError('Select an engagement for this project.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        account_id: form.account_id || null,
        engagement_id: form.engagement_id || null,
        estimated_end_date: form.estimated_end_date || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        hourly_rate: form.hourly_rate ? parseFloat(String(form.hourly_rate)) : null,
      }

      const response = initialProject?.id
        ? await apiFetch<{ project: Project }>(`/api/projects/${initialProject.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ project: Project }>('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      router.push(`/projects/records/${response.project.id}`)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!initialProject?.id || archiving || deleting) {
      return
    }

    setArchiving(true)
    setError(null)

    try {
      await apiFetch<{ project: Project }>(`/api/projects/${initialProject.id}`, {
        method: 'DELETE',
      })
      setArchiveConfirmOpen(false)
      router.push('/projects')
      router.refresh()
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Failed to archive project')
    } finally {
      setArchiving(false)
    }
  }

  async function handleDelete() {
    if (!initialProject?.id || archiving || deleting) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await apiFetch<{ deleted: boolean }>(`/api/projects/${initialProject.id}?hard=true`, {
        method: 'DELETE',
      })
      setDeleteConfirmOpen(false)
      router.push('/projects')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="os-card space-y-6 p-6">
      <div>
        <p className="os-eyebrow text-[color:var(--accent-strong)]">Delivery</p>
        <h1 className="os-page-title mt-2">
          {initialProject ? 'Edit project' : 'New project'}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="os-input w-full"
          />
        </label>

        <EntityCombobox
          label="Account"
          entity="account"
          value={form.account_id}
          selectedLabel={accountOptions.find((o) => o.value === form.account_id)?.label}
          onChange={(opt) => setForm({ ...form, account_id: opt.id })}
          clearable
        />

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Engagement{!initialProject ? ' *' : ''}</span>
          <EngagementPicker
            engagements={engagements}
            value={form.engagement_id}
            onChange={(value) => setForm({ ...form, engagement_id: value })}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}
            className="os-select w-full"
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Start date</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
            className="os-input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">End date</span>
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
            className="os-input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Estimated end</span>
          <input
            type="date"
            value={form.estimated_end_date}
            onChange={(event) => setForm({ ...form, estimated_end_date: event.target.value })}
            className="os-input w-full"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[color:var(--text-2)]">Hourly rate (£)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.hourly_rate}
            onChange={(event) => setForm({ ...form, hourly_rate: event.target.value })}
            placeholder="e.g. 85.00"
            className="os-input w-full"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={4}
            className="os-textarea w-full"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-[color:var(--text-2)]">Brief</span>
          <textarea
            value={form.brief}
            onChange={(event) => setForm({ ...form, brief: event.target.value })}
            rows={6}
            className="os-textarea w-full"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || archiving || deleting || !form.name.trim()}
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-2xl border border-[color:var(--border)] px-5 py-3 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--border-light)]"
        >
          Cancel
        </button>
        {initialProject ? (
          <button
            type="button"
            onClick={() => setArchiveConfirmOpen(true)}
            disabled={saving || archiving || deleting}
            className="rounded-2xl border border-[color:var(--amber)] px-5 py-3 text-sm font-medium text-[color:var(--amber-strong)] transition hover:border-[color:var(--amber-strong)] disabled:opacity-50"
          >
            {archiving ? 'Archiving...' : 'Archive project'}
          </button>
        ) : null}
        {initialProject ? (
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={saving || archiving || deleting}
            className="rounded-2xl border border-[color:var(--red)] px-5 py-3 text-sm font-medium text-[color:var(--red-strong)] transition hover:border-[color:var(--red-strong)] disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        ) : null}
      </div>

      {initialProject ? (
        <>
          <ConfirmDialog
            open={archiveConfirmOpen}
            onOpenChange={setArchiveConfirmOpen}
            title="Archive project?"
            description="This project will be moved to cancelled status but kept in the database."
            confirmLabel="Archive"
            onConfirm={() => void handleArchive()}
            loading={archiving}
            variant="warning"
          />
          <ConfirmDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            title="Delete project permanently?"
            description="Linked phases, milestones, and project contacts will be removed. Tasks will remain but will be detached from the project."
            confirmLabel="Delete permanently"
            onConfirm={() => void handleDelete()}
            loading={deleting}
            variant="destructive"
          />
        </>
      ) : null}
    </div>
  )
}