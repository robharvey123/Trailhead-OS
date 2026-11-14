import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CreateWorkspaceForm from './CreateWorkspaceForm'

export default async function WorkspacesPage() {
  const supabase = await createClient()
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at, is_paid')
    .order('created_at', { ascending: false })

  const hasWorkspaces = Boolean(workspaces?.length)

  return (
    <div className="space-y-8">
      <header>
        <p className="os-label">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">Workspaces</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Your workspaces</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            Choose a workspace to view analytics or manage data.
          </p>

          {hasWorkspaces ? (
            <div className="mt-6 space-y-3">
              {workspaces?.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/analytics/${workspace.id}`}
                  className="flex items-center justify-between rounded-control border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] no-underline transition hover:border-[var(--border-light)] hover:bg-[var(--surface-2)]"
                >
                  <span>{workspace.name}</span>
                  <span className="text-xs text-[var(--text-3)]">
                    {workspace.is_paid ? 'Paid' : 'Trial'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-control border border-dashed border-[var(--border-light)] p-6 text-sm text-[var(--text-3)]">
              No workspaces yet. Create one to start importing data.
            </div>
          )}
        </div>

        <div className="rounded-card border border-[var(--border)] bg-[var(--bg)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text)]">Create a workspace</h2>
          <p className="mt-2 text-sm text-[var(--text-2)]">
            Workspaces isolate each brand and its customers.
          </p>
          <div className="mt-6">
            <CreateWorkspaceForm />
          </div>
        </div>
      </section>
    </div>
  )
}
