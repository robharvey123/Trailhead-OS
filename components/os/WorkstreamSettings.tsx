'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getWorkstreamColourClasses } from '@/lib/os'
import type { Workstream } from '@/lib/types'

const COLOUR_OPTIONS = [
  { value: 'teal', label: 'Teal' },
  { value: 'amber', label: 'Amber' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'coral', label: 'Coral' },
  { value: 'blue', label: 'Blue' },
] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function WorkstreamSettings({
  initialWorkstreams,
}: {
  initialWorkstreams: Workstream[]
}) {
  const [workstreams, setWorkstreams] = useState(initialWorkstreams)
  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [colour, setColour] = useState<(typeof COLOUR_OPTIONS)[number]['value']>('blue')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const nextSortOrder = useMemo(() => {
    return workstreams.reduce((max, workstream) => Math.max(max, workstream.sort_order), 0) + 1
  }, [workstreams])

  const previewSlug = slugTouched ? slugify(slug) : slugify(label)

  async function handleCreateWorkstream(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/workstreams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          slug: previewSlug,
          colour,
          sort_order: nextSortOrder,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workstream')
      }

      const workstream = data.workstream as Workstream
      setWorkstreams((current) =>
        [...current, workstream].sort((left, right) => left.sort_order - right.sort_order)
      )
      setLabel('')
      setSlug('')
      setSlugTouched(false)
      setColour('blue')
      setSuccess(`${workstream.label} created`)
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Failed to create workstream'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <section className="os-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="os-eyebrow">Workstreams</p>
          <h2 className="os-section-title mt-2">Workstream manager</h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
            Add a new workstream and it will appear automatically in the sidebar, project
            boards, task forms, and calendar event picker.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[color:var(--text-2)]">
          Next position: {nextSortOrder}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form
          onSubmit={handleCreateWorkstream}
          className="rounded-[1.75rem] border border-[color:var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="grid gap-4">
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Label</span>
              <input
                value={label}
                onChange={(event) => {
                  const nextLabel = event.target.value
                  setLabel(nextLabel)
                  if (!slugTouched) {
                    setSlug(slugify(nextLabel))
                  }
                }}
                placeholder="Personal admin"
                className="os-input w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Slug</span>
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true)
                  setSlug(event.target.value)
                }}
                placeholder="personal-admin"
                className="os-input w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Colour</span>
              <select
                value={colour}
                onChange={(event) =>
                  setColour(event.target.value as (typeof COLOUR_OPTIONS)[number]['value'])
                }
                className="os-select w-full"
              >
                {COLOUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
            <p className="os-eyebrow">Preview</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${getWorkstreamColourClasses(colour).dot}`}
                />
                <div>
                  <p className="text-sm font-medium text-[color:var(--text)]">
                    {label.trim() || 'New workstream'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-3)]">/projects/{previewSlug || 'new-workstream'}</p>
                </div>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs ${getWorkstreamColourClasses(
                  colour
                ).badge}`}
              >
                {colour}
              </span>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-[color:var(--red-strong)]">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-[color:var(--emerald-strong)]">{success}</p> : null}

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-[color:var(--text-3)]">
              Default board columns will be created automatically.
            </p>
            <button
              type="submit"
              disabled={creating || !label.trim() || !previewSlug}
              className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create workstream'}
            </button>
          </div>
        </form>

        <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[color:var(--text)]">Current workstreams</h3>
              <p className="mt-1 text-sm text-[color:var(--text-2)]">
                Ordered as they appear in the sidebar.
              </p>
            </div>
            <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--text-2)]">
              {workstreams.length} total
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {workstreams.map((workstream) => (
              <div
                key={workstream.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${getWorkstreamColourClasses(
                        workstream.colour
                      ).dot}`}
                    />
                    <p className="truncate text-sm font-medium text-[color:var(--text)]">
                      {workstream.label}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-3)]">
                    /projects/{workstream.slug} · order {workstream.sort_order}
                  </p>
                </div>
                <Link
                  href={`/projects/${workstream.slug}`}
                  className="rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  Open board
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
