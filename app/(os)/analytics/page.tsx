import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CreateWorkspaceForm from '@/app/(app)/workspaces/CreateWorkspaceForm'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at, is_paid')
    .order('created_at', { ascending: false })

  const hasWorkspaces = Boolean(workspaces?.length)

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">
          Analytics
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Workspaces</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-6">
          <h2 className="text-lg font-semibold">Your workspaces</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Choose a workspace to view analytics or manage data.
          </p>

          {hasWorkspaces ? (
            <div className="mt-6 space-y-3">
              {workspaces?.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/analytics/${workspace.id}`}
                  className="flex items-center justify-between rounded-lg border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm transition hover:border-[#2A2A3A]"
                >
                  <span>{workspace.name}</span>
                  <span className="text-xs text-[#9CA3AF]">
                    {workspace.is_paid ? 'Paid' : 'Trial'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-[#2A2A3A] p-6 text-sm text-[#9CA3AF]">
              No workspaces yet. Create one to start importing data.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#2A2A3A] bg-[#1A1A28] p-6">
          <h2 className="text-lg font-semibold">Create a workspace</h2>
          <p className="mt-2 text-sm text-[#9CA3AF]">
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
