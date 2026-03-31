'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Account, Project, ProjectStatus, Workstream } from '@/lib/types'
import SearchSelect from './SearchSelect'

const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]

export default function ProjectForm({
  workstreams,
  accounts,
  initialProject = null,
  initialValues,
  cancelHref = '/projects',
}: {
  workstreams: Workstream[]
  accounts: Account[]
  initialProject?: Project | null
  initialValues?: {
    workstream_id?: string
    account_id?: string
    name?: string
    description?: string
    brief?: string
  }
  cancelHref?: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: initialProject?.name ?? initialValues?.name ?? '',
    workstream_id: initialProject?.workstream_id ?? initialValues?.workstream_id ?? '',
    account_id: initialProject?.account_id ?? initialValues?.account_id ?? '',
    status: initialProject?.status ?? ('planning' as ProjectStatus),
    start_date: initialProject?.start_date ?? '',
    end_date: initialProject?.end_date ?? '',
    estimated_end_date: initialProject?.estimated_end_date ?? '',
    description: initialProject?.description ?? initialValues?.description ?? '',
    brief: initialProject?.brief ?? initialValues?.brief ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    setSaving(true)
    setError(null)

    try {
      const payload = {
        ...form,
        account_id: form.account_id || null,
        estimated_end_date: form.estimated_end_date || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
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

    const confirmed = window.confirm('Archive this project? It will be moved to cancelled status but kept in the database.')
    if (!confirmed) {
      return
    }

    setArchiving(true)
    setError(null)

    try {
      await apiFetch<{ project: Project }>(`/api/projects/${initialProject.id}`, {
        method: 'DELETE',
      })
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

    const confirmed = window.confirm(
      'Permanently delete this project? Linked phases, milestones, and project contacts will be removed. Tasks will remain but will be detached from the project.'
    )
    if (!confirmed) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await apiFetch<{ deleted: boolean }>(`/api/projects/${initialProject.id}?hard=true`, {
        method: 'DELETE',
      })
      router.push('/projects')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Delivery</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">
          {initialProject ? 'Edit project' : 'New project'}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Workstream</span>
          <select
            value={form.workstream_id}
            onChange={(event) => setForm({ ...form, workstream_id: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            <option value="">Select workstream</option>
            {workstreams.map((workstream) => (
              <option key={workstream.id} value={workstream.id}>
                {workstream.label}
              </option>
            ))}
          </select>
        </label>

        <SearchSelect
          label="Account"
          value={form.account_id}
          options={accountOptions}
          onChange={(value) => setForm({ ...form, account_id: value })}
          placeholder="Search accounts"
          emptyLabel="No account"
        />

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Start date</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">End date</span>
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-slate-300">Estimated end</span>
          <input
            type="date"
            value={form.estimated_end_date}
            onChange={(event) => setForm({ ...form, estimated_end_date: event.target.value })}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={4}
            className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm text-slate-300">Brief</span>
          <textarea
            value={form.brief}
            onChange={(event) => setForm({ ...form, brief: event.target.value })}
            rows={6}
            className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || archiving || deleting || !form.name.trim() || !form.workstream_id}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
        >
          Cancel
        </button>
        {initialProject ? (
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={saving || archiving || deleting}
            className="rounded-2xl border border-amber-500/30 px-5 py-3 text-sm font-medium text-amber-100 transition hover:border-amber-400 disabled:opacity-60"
          >
            {archiving ? 'Archiving...' : 'Archive project'}
          </button>
        ) : null}
        {initialProject ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving || archiving || deleting}
            className="rounded-2xl border border-rose-500/30 px-5 py-3 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        ) : null}
      </div>
    </div>
  )
}