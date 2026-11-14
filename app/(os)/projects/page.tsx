import Link from 'next/link'
import ProjectCard from '@/components/os/ProjectCard'
import PageHeader from '@/components/ui/PageHeader'
import { getProjects } from '@/lib/db/projects'
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
  searchParams?: Promise<{ status?: string; search?: string; account_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const activeStatus = resolvedSearchParams?.status ?? 'all'
  const search = resolvedSearchParams?.search ?? ''
  const supabase = await createClient()

  const projects = await getProjects(
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
    },
    supabase
  ).catch(() => [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        count={projects.length}
        actions={
          <Link
            href="/projects/new"
            className="rounded-card bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            New project
          </Link>
        }
      />

      <form className="os-card grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by project name or summary"
          className="os-input rounded-control px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="rounded-card bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
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

          const href = params.toString() ? `/projects?${params}` : '/projects'
          const active = activeStatus === tab.value

          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-pill border px-4 py-2 text-sm transition ${
                active
                  ? 'border-[color:var(--border)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                  : 'border-[color:var(--border)] text-[color:var(--text-2)] hover:border-[color:var(--border-light)] hover:text-[color:var(--text)]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
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