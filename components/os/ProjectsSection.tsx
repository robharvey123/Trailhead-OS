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
    <section className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-[#9CA3AF]">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-8 text-sm text-white0">
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