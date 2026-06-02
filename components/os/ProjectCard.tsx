'use client'

import Link from 'next/link'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { getWorkstreamColourClasses } from '@/lib/os'
import type { ProjectListItem } from '@/lib/types'
import ConfirmDialog from './ConfirmDialog'
import ProjectStatusBadge from './ProjectStatusBadge'
import WorkstreamBadge from './WorkstreamBadge'

export default function ProjectCard({
  project,
  onDeleted,
}: {
  project: ProjectListItem
  onDeleted?: (id: string) => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const wsHex = project.workstream
    ? getWorkstreamColourClasses(project.workstream.colour ?? project.workstream.slug).hex
    : '#E2E8F0'

  const hasLinkedTasks = project.task_count > 0

  async function handleDelete(cascade: boolean) {
    setDeleting(true)
    try {
      const qs = cascade ? '?hard=true&cascade=true' : '?hard=true'
      await apiFetch(`/api/projects/${project.id}${qs}`, { method: 'DELETE' })
      setConfirmOpen(false)
      onDeleted?.(project.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="group relative">
        <Link
          href={`/projects/records/${project.id}`}
          className="os-card block rounded-[1.75rem] p-5 transition hover:bg-[var(--surface-2)]"
          style={{ borderTop: `3px solid ${wsHex}` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-[color:var(--text)]">{project.name}</p>
              <p className="mt-2 line-clamp-2 text-sm text-[color:var(--text-2)]">
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
          <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-2)]">
            {project.account.name}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 text-sm text-[color:var(--text-2)] sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[color:var(--text-3)]">Tasks</p>
          <p className="mt-1 font-bold text-[color:var(--text)]">{project.completed_task_count}/{project.task_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[color:var(--text-3)]">Contacts</p>
          <p className="mt-1 font-bold text-[color:var(--text)]">{project.contact_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[color:var(--text-3)]">Start</p>
          <p className="mt-1 font-bold text-[color:var(--text)]">{project.start_date ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[3px] text-[color:var(--text-3)]">Next milestone</p>
          <p className="mt-1 font-bold text-[color:var(--text)]">
            {project.next_milestone ? project.next_milestone.name : '—'}
          </p>
        </div>
      </div>
    </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConfirmOpen(true)
          }}
          className="absolute right-3 top-3 rounded-lg border border-[color:var(--border)] bg-white p-1.5 text-[color:var(--text-2)] opacity-0 transition hover:border-[color:var(--red)] hover:text-[color:var(--red-strong)] group-hover:opacity-100"
          title="Delete project"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete project?"
        description={`"${project.name}" will be permanently removed. This cannot be undone.`}
        items={hasLinkedTasks ? [`${project.task_count} task${project.task_count > 1 ? 's' : ''} linked to this project`] : undefined}
        itemsLabel={hasLinkedTasks ? 'Affected tasks' : undefined}
        confirmLabel={hasLinkedTasks ? 'Delete project + tasks' : 'Delete project'}
        secondaryAction={hasLinkedTasks ? { label: 'Delete project only', onClick: () => void handleDelete(false) } : undefined}
        onConfirm={() => void handleDelete(hasLinkedTasks)}
        loading={deleting}
        variant="destructive"
      />
    </>
  )
}