import Link from 'next/link'
import type { ProjectListItem } from '@/lib/types'
import ProjectStatusBadge from './ProjectStatusBadge'
import WorkstreamBadge from './WorkstreamBadge'

export default function ProjectCard({
  project,
}: {
  project: ProjectListItem
}) {
  return (
    <Link
      href={`/projects/records/${project.id}`}
      className="block rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-600"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-slate-100">{project.name}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-400">
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
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300">
            {project.account.name}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tasks</p>
          <p className="mt-1 font-medium text-slate-100">{project.completed_task_count}/{project.task_count}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contacts</p>
          <p className="mt-1 font-medium text-slate-100">{project.contact_count}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Start</p>
          <p className="mt-1 font-medium text-slate-100">{project.start_date ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Next milestone</p>
          <p className="mt-1 font-medium text-slate-100">
            {project.next_milestone ? project.next_milestone.name : '—'}
          </p>
        </div>
      </div>
    </Link>
  )
}