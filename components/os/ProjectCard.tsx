import Link from 'next/link'
import { getWorkstreamColourClasses } from '@/lib/os'
import type { ProjectListItem } from '@/lib/types'
import ProjectStatusBadge from './ProjectStatusBadge'
import WorkstreamBadge from './WorkstreamBadge'

export default function ProjectCard({
  project,
}: {
  project: ProjectListItem
}) {
  const wsHex = project.workstream
    ? getWorkstreamColourClasses(project.workstream.colour ?? project.workstream.slug).hex
    : '#2A2A3A'

  return (
    <Link
      href={`/projects/records/${project.id}`}
      className="block rounded-[1.75rem] border border-[#2A2A3A] bg-[#1A1A28] p-5 transition hover:bg-[#B8FF00]/[0.03]"
      style={{ borderTop: `3px solid ${wsHex}` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{project.name}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[#9CA3AF]">
            {project.description || project.brief || 'No project summary yet.'}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {project.workstream ? (
          <WorkstreamBadge
            label={project.workstream.label}
            slug={project.workstream.slug}
            colour={project.workstream.colour}
          />
        ) : null}
        {project.account ? (
          <span className="rounded-full border border-[#2A2A3A] px-2.5 py-1 text-[11px] font-medium text-[#9CA3AF]">
            {project.account.name}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-[#9CA3AF] sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#9CA3AF]">Tasks</p>
          <p className="mt-1 font-bold text-white">{project.completed_task_count}/{project.task_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#9CA3AF]">Contacts</p>
          <p className="mt-1 font-bold text-white">{project.contact_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#9CA3AF]">Start</p>
          <p className="mt-1 font-bold text-white">{project.start_date ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[#9CA3AF]">Next milestone</p>
          <p className="mt-1 font-bold text-white">
            {project.next_milestone ? project.next_milestone.name : '—'}
          </p>
        </div>
      </div>
    </Link>
  )
}