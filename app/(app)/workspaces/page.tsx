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
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Workspaces</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Your workspaces</h2>
          <p className="mt-2 text-sm text-slate-300">
            Choose a workspace to view analytics or manage data.
          </p>

          {hasWorkspaces ? (
            <div className="mt-6 space-y-3">
              {workspaces?.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspace/${workspace.id}/dashboard`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm transition hover:border-slate-700"
                >
                  <span>{workspace.name}</span>
                  <span className="text-xs text-slate-400">
                    {workspace.is_paid ? 'Paid' : 'Trial'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-300">
              No workspaces yet. Create one to start importing data.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Create a workspace</h2>
          <p className="mt-2 text-sm text-slate-300">
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
