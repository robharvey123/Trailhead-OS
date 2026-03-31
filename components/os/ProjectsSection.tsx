import Link from 'next/link'
import type { ProjectListItem } from '@/lib/types'
import ProjectCard from './ProjectCard'

export default function ProjectsSection({
  title,
  description,
  projects,
  emptyMessage,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  projects: ProjectListItem[]
  emptyMessage: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  )
}