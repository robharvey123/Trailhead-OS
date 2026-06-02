import Link from 'next/link'
import type { ProjectDetail as ProjectDetailType } from '@/lib/types'
import ProjectStatusBadge from './ProjectStatusBadge'
import WorkstreamBadge from './WorkstreamBadge'

export default function ProjectDetail({
  project,
}: {
  project: ProjectDetailType
}) {
  const openTasks = project.tasks.filter((task) => !task.completed_at)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="os-eyebrow">Projects</p>
          <h1 className="os-page-title mt-2">{project.name}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {project.description || project.brief || 'No summary added yet.'}
          </p>
        </div>
        <div className="flex gap-3">
          <ProjectStatusBadge status={project.status} />
          <Link
            href={`/projects/records/${project.id}/edit`}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {project.workstream ? (
          <WorkstreamBadge
            label={project.workstream.label}
            slug={project.workstream.slug}
            colour={project.workstream.colour}
          />
        ) : null}
        {project.account ? (
          <Link
            href={`/crm/accounts/${project.account.id}`}
            className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
          >
            {project.account.name}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-6">
          <div className="os-card p-6">
            <h2 className="os-section-title">Timeline</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <p className="os-eyebrow">Start</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{project.start_date ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">End</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{project.end_date ?? '—'}</p>
              </div>
              <div>
                <p className="os-eyebrow">Estimated end</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">{project.estimated_end_date ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="os-card p-6">
            <h2 className="os-section-title">Open tasks</h2>
            {openTasks.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No tasks linked to this project yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {openTasks.map((task) => (
                  <div key={task.id} className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                    <p className="font-medium text-[color:var(--text)]">{task.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">
                      {task.phase_name ? `${task.phase_name} · ` : ''}{task.due_date ?? 'No due date'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="os-card p-6">
            <h2 className="os-section-title">Phases</h2>
            {project.phases.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No phases yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {project.phases.map((phase) => (
                  <div key={phase.id} className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                    <p className="font-medium text-[color:var(--text)]">{phase.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">
                      {phase.start_date ?? '—'} to {phase.end_date ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="os-card p-6">
            <h2 className="os-section-title">Milestones</h2>
            {project.milestones.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No milestones yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {project.milestones.map((milestone) => (
                  <div key={milestone.id} className="rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                    <p className="font-medium text-[color:var(--text)]">{milestone.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">{milestone.date}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="os-card p-6">
            <h2 className="os-section-title">Contacts</h2>
            {project.contacts.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No contacts linked yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {project.contacts.map((contact) => (
                  <Link
                    key={contact.id}
                    href={`/crm/contacts/${contact.id}`}
                    className="block rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4 transition hover:border-[color:var(--border-light)]"
                  >
                    <p className="font-medium text-[color:var(--text)]">{contact.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">{contact.company ?? contact.email ?? 'No company set'}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="os-card p-6">
            <h2 className="os-section-title">Enquiries</h2>
            {project.enquiries.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No enquiries linked yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {project.enquiries.map((enquiry) => (
                  <Link
                    key={enquiry.id}
                    href={`/enquiries/${enquiry.id}`}
                    className="block rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4 transition hover:border-[color:var(--border-light)]"
                  >
                    <p className="font-medium text-[color:var(--text)]">{enquiry.biz_name}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-2)]">
                      {enquiry.contact_name} · {new Date(enquiry.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}