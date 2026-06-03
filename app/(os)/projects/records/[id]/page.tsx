import { notFound } from 'next/navigation'
import Link from 'next/link'
import ProjectWorkspaceClient from '@/components/os/ProjectWorkspaceClient'
import { getProjectById } from '@/lib/db/projects'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { mockupFontVars } from '@/lib/fonts'

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const project = await getProjectById(id, supabase).catch(() => null)

  if (!project) {
    notFound()
  }

  const profile = await getCurrentProfile(supabase).catch(() => null)
  const isAdmin = roleIsAdmin(profile?.role)
  const imports = isAdmin
    ? (await supabase
        .from('roadmap_imports')
        .select('id, source_filename, status, task_count_committed, created_at')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(10)).data ?? []
    : []

  return (
    <>
      <ProjectWorkspaceClient project={project} />

      {isAdmin ? (
        <div className={`thmock ${mockupFontVars}`} style={{ marginTop: 16 }}>
          <div className="panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="panel-section-title" style={{ margin: 0 }}>Roadmap imports</div>
              <Link className="btn btn-primary btn-sm" href={`/projects/records/${id}/import-roadmap`}>Import roadmap</Link>
            </div>
            {imports.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No imports yet. Upload a .docx or .md roadmap to extract tasks.</p>
            ) : (
              <table className="data-table">
                <thead><tr><th>File</th><th>Status</th><th>Tasks</th><th>Imported</th></tr></thead>
                <tbody>
                  {imports.map((imp) => (
                    <tr key={imp.id} style={{ cursor: 'pointer' }}>
                      <td className="td-name">
                        <Link href={`/projects/records/${id}/import-roadmap?import_id=${imp.id}`}>{imp.source_filename}</Link>
                      </td>
                      <td><span className="channel-tag">{imp.status}</span></td>
                      <td className="td-mono">{imp.task_count_committed ?? '—'}</td>
                      <td className="td-mono">{fmtDate(imp.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
