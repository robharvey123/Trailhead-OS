import Link from 'next/link'
import ProjectCard from '@/components/os/ProjectCard'
import { getProjects } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { ProjectStatus } from '@/lib/types'

const PROJECT_TABS: Array<{ value: 'all' | ProjectStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
]

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; search?: string; workstream_id?: string; account_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const search = resolvedSearchParams?.search ?? ''
  const workstreamId = resolvedSearchParams?.workstream_id ?? ''
  const supabase = await createClient()

  const [projects, workstreams] = await Promise.all([
    getProjects(
      {
        status:
          activeStatus === 'planning' ||
          activeStatus === 'active' ||
          activeStatus === 'on_hold' ||
          activeStatus === 'completed' ||
          activeStatus === 'cancelled'
            ? activeStatus
            : undefined,
        search: search || undefined,
        workstream_id: workstreamId || undefined,
      },
      supabase
    ).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Delivery</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">
            Projects <span className="text-slate-500">({projects.length})</span>
          </h1>
        </div>
        <Link
          href="/projects/new"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          New project
        </Link>
      </div>

      <form className="grid gap-3 rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-[minmax(0,1fr)_240px_auto]">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by project name or summary"
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        />
        <select
          name="workstream_id"
          defaultValue={workstreamId}
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
        >
          <option value="">All workstreams</option>
          {workstreams.map((workstream) => (
            <option key={workstream.id} value={workstream.id}>
              {workstream.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {PROJECT_TABS.map((tab) => {
          const params = new URLSearchParams()
          if (tab.value !== 'all') {
            params.set('status', tab.value)
          }
          if (search) {
            params.set('search', search)
          }
          if (workstreamId) {
            params.set('workstream_id', workstreamId)
          }

          const href = params.toString() ? `/projects?${params}` : '/projects'
          const active = activeStatus === tab.value

          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
          No projects match this view yet.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}